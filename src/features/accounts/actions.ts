"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ZodError } from "zod";

import { db } from "@/db/client";
import { tradingAccounts, type TradingAccount } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import {
  ACTIVE_ACCOUNT_ALL,
  ACTIVE_ACCOUNT_COOKIE,
} from "@/features/accounts/constants";
import {
  archiveAccountSchema,
  createAccountSchema,
  renameAccountSchema,
  rotateKeySchema,
  updateTimezoneSchema,
} from "@/features/accounts/schemas";
import {
  generateIngestKey,
  hashIngestKey,
  ingestKeyPrefix,
} from "@/features/accounts/key";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Fail-safe error mapping for account toasts: validation issues surface their
 * real message; Postgres unique violations (re-adding the same
 * user+login+server — trading_accounts_user_login_server_uq) get an
 * actionable hint instead of a catch-all, which is exactly what the owner
 * hit when re-adding the already-bound Demo Account (2026-11).
 */
function onActionError(error: unknown): { ok: false; error: string } {
  console.error("[accounts:action]", error);
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid input." };
  }
  const asRecord = (error ?? {}) as { code?: unknown; constraint?: unknown };
  const isUnique =
    asRecord.code === "23505" ||
    (typeof asRecord.constraint === "string" &&
      asRecord.constraint.includes("login_server"));
  if (isUnique) {
    return {
      ok: false,
      error:
        "An account with this broker login + server already exists — it is already on your Accounts list. Attach the EA to it or rotate its key instead of creating a duplicate.",
    };
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidateAccountPages(): void {
  revalidatePath("/accounts");
  // The switcher lives in the (app) layout header on every page.
  revalidatePath("/dashboard");
}

/**
 * Creates an account together with its first ingest key (spec §5.3).
 * The raw key is returned exactly once — only hash + prefix are persisted.
 */
export async function createAccountWithKey(
  input: unknown,
): Promise<ActionResult<{ account: TradingAccount; key: string; keyPrefix: string }>> {
  const user = await requireUser();
  try {
    const parsed = createAccountSchema.parse(input ?? {});
    const key = generateIngestKey();

    const [account] = await db
      .insert(tradingAccounts)
      .values({
        userId: user.id,
        displayName: parsed.displayName || "Untitled account",
        login: parsed.login ?? null,
        server: parsed.server || null,
        broker: parsed.broker || null,
        currency: parsed.currency ?? "USD",
        isDemo: parsed.isDemo ?? false,
        ingestKeyHash: hashIngestKey(key),
        ingestKeyPrefix: ingestKeyPrefix(key),
      })
      .returning();

    revalidateAccountPages();
    return { ok: true, data: { account, key, keyPrefix: account.ingestKeyPrefix } };
  } catch (error) {
    return onActionError(error);
  }
}

export async function renameAccount(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  try {
    const { accountId, displayName } = renameAccountSchema.parse(input);

    const updated = await db
      .update(tradingAccounts)
      .set({ displayName })
      .where(
        and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, user.id)),
      )
      .returning({ id: tradingAccounts.id });
    if (updated.length === 0) return { ok: false, error: "Account not found." };

    revalidateAccountPages();
    return { ok: true, data: null };
  } catch (error) {
    return onActionError(error);
  }
}

/** Rotates the ingest key (spec §5.3). Returns the new key exactly once. */
export async function rotateIngestKey(
  input: unknown,
): Promise<ActionResult<{ key: string; keyPrefix: string }>> {
  const user = await requireUser();
  try {
    const { accountId } = rotateKeySchema.parse(input);
    const key = generateIngestKey();

    const updated = await db
      .update(tradingAccounts)
      .set({ ingestKeyHash: hashIngestKey(key), ingestKeyPrefix: ingestKeyPrefix(key) })
      .where(
        and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, user.id)),
      )
      .returning({
        id: tradingAccounts.id,
        keyPrefix: tradingAccounts.ingestKeyPrefix,
      });
    if (updated.length === 0) return { ok: false, error: "Account not found." };

    revalidateAccountPages();
    return { ok: true, data: { key, keyPrefix: updated[0].keyPrefix } };
  } catch (error) {
    return onActionError(error);
  }
}

/** Soft archive (§4.3 `archived_at`) — archived accounts leave every list. */
export async function archiveAccount(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  try {
    const { accountId, archived } = archiveAccountSchema.parse(input);

    const updated = await db
      .update(tradingAccounts)
      .set({ archivedAt: archived ? new Date() : null })
      .where(
        and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, user.id)),
      )
      .returning({ id: tradingAccounts.id });
    if (updated.length === 0) return { ok: false, error: "Account not found." };

    revalidateAccountPages();
    return { ok: true, data: null };
  } catch (error) {
    return onActionError(error);
  }
}

export async function updateTimezone(input: unknown): Promise<ActionResult<null>> {
  const user = await requireUser();
  try {
    const { accountId, timezone } = updateTimezoneSchema.parse(input);

    const updated = await db
      .update(tradingAccounts)
      .set({ timezone })
      .where(
        and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, user.id)),
      )
      .returning({ id: tradingAccounts.id });
    if (updated.length === 0) return { ok: false, error: "Account not found." };

    revalidateAccountPages();
    return { ok: true, data: null };
  } catch (error) {
    return onActionError(error);
  }
}

/**
 * Switcher persistence (spec §8.1): URL first, cookie as the RSC-readable
 * mirror. Called from the client switcher alongside the URL update.
 * httpOnly — the value is not secret, but it is not meant to be read by JS.
 */
export async function setActiveAccountCookie(accountId: string | null): Promise<void> {
  await requireUser();
  const jar = await cookies();
  if (!accountId) {
    jar.set(ACTIVE_ACCOUNT_COOKIE, ACTIVE_ACCOUNT_ALL, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return;
  }
  jar.set(ACTIVE_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
