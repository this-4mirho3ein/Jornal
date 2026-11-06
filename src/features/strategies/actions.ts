"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { magicStrategyMap, strategies, trades, tradingAccounts } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import {
  archiveStrategySchema,
  createStrategySchema,
  removeMagicMappingSchema,
  setMagicMappingSchema,
  setTradeStyleSchema,
  updateStrategySchema,
} from "@/features/strategies/schemas";
import type { ActionResult } from "@/features/accounts/actions";
import { getAccountById } from "@/features/accounts/queries";

function onActionError(error: unknown): { ok: false; error: string } {
  if (isUniqueViolation(error)) {
    return { ok: false, error: "That strategy code is already in use. Codes must be unique." };
  }
  console.error("[strategies:action]", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/** Drizzle wraps the pg driver error — walk the cause chain for 23505. */
function isUniqueViolation(error: unknown): boolean {
  let cursor: unknown = error;
  while (cursor instanceof Error) {
    if ((cursor as { code?: unknown }).code === "23505") return true;
    cursor = (cursor as { cause?: unknown }).cause;
  }
  return false;
}

function revalidateStrategies(): void {
  revalidatePath("/strategies");
  // Strategy chips appear in the dashboard/trades surfaces too.
  revalidatePath("/dashboard");
  revalidatePath("/trades");
}

/** Case-insensitive code duplicate check for one user (excluding one row). */
async function codeTaken(userId: string, code: string, excludeId?: string) {
  const rows = await db
    .select({ id: strategies.id })
    .from(strategies)
    .where(
      and(
        eq(strategies.userId, userId),
        sql`lower(${strategies.code}) = lower(${code})`,
        excludeId ? ne(strategies.id, excludeId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function createStrategy(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const parsed = createStrategySchema.parse(input ?? {});
    if (await codeTaken(user.id, parsed.code)) {
      return { ok: false, error: `Code "${parsed.code}" is already in use. Codes must be unique.` };
    }
    const [row] = await db
      .insert(strategies)
      .values({
        userId: user.id,
        name: parsed.name,
        code: parsed.code,
        color: parsed.color || null,
        description: parsed.description || null,
        defaultStyle: parsed.defaultStyle || null,
      })
      .returning({ id: strategies.id });
    revalidateStrategies();
    return { ok: true, data: { id: row.id } };
  } catch (error) {
    return onActionError(error);
  }
}

export async function updateStrategy(input: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const parsed = updateStrategySchema.parse(input);
    const owned = await db
      .select({ id: strategies.id })
      .from(strategies)
      .where(and(eq(strategies.id, parsed.strategyId), eq(strategies.userId, user.id)))
      .limit(1);
    if (owned.length === 0) return { ok: false, error: "Strategy not found." };
    if (await codeTaken(user.id, parsed.code, parsed.strategyId)) {
      return { ok: false, error: `Code "${parsed.code}" is already in use. Codes must be unique.` };
    }
    await db
      .update(strategies)
      .set({
        name: parsed.name,
        code: parsed.code,
        color: parsed.color || null,
        description: parsed.description || null,
        defaultStyle: parsed.defaultStyle || null,
      })
      .where(
        and(eq(strategies.id, parsed.strategyId), eq(strategies.userId, user.id)),
      );
    revalidateStrategies();
    return { ok: true, data: null };
  } catch (error) {
    return onActionError(error);
  }
}

/**
 * Soft archive (§4.3 `archived_at`). Existing trades keep their assignment;
 * past magic mappings stay in the table but archived strategies are hidden
 * from the mapping manager, so no NEW mapping can target them.
 */
export async function archiveStrategy(input: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const { strategyId, archived } = archiveStrategySchema.parse(input);
    const updated = await db
      .update(strategies)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(strategies.id, strategyId), eq(strategies.userId, user.id)))
      .returning({ id: strategies.id });
    if (updated.length === 0) return { ok: false, error: "Strategy not found." };
    revalidateStrategies();
    return { ok: true, data: null };
  } catch (error) {
    return onActionError(error);
  }
}

/** Upserts one magic→strategy row for an owned account (the ingest map, §4.3). */
export async function setMagicMapping(input: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const { accountId, magic, strategyId } = setMagicMappingSchema.parse(input);

    const account = await getAccountById(accountId, user.id);
    if (!account) return { ok: false, error: "Account not found." };

    const ownedStrategy = await db
      .select({ id: strategies.id })
      .from(strategies)
      .where(and(eq(strategies.id, strategyId), eq(strategies.userId, user.id)))
      .limit(1);
    if (ownedStrategy.length === 0) return { ok: false, error: "Strategy not found." };

    await db
      .insert(magicStrategyMap)
      .values({ accountId, magic, strategyId })
      .onConflictDoUpdate({
        target: [magicStrategyMap.accountId, magicStrategyMap.magic],
        set: { strategyId },
      });
    revalidateStrategies();
    return { ok: true, data: null };
  } catch (error) {
    return onActionError(error);
  }
}

export async function removeMagicMapping(input: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const { accountId, magic } = removeMagicMappingSchema.parse(input);
    const account = await getAccountById(accountId, user.id);
    if (!account) return { ok: false, error: "Account not found." };
    await db
      .delete(magicStrategyMap)
      .where(and(eq(magicStrategyMap.accountId, accountId), eq(magicStrategyMap.magic, magic)));
    revalidateStrategies();
    return { ok: true, data: null };
  } catch (error) {
    return onActionError(error);
  }
}

/**
 * Manual style override (§9) — sets `style_source='manual'` so the ingest
 * reducer never re-classifies this trade automatically.
 */
export async function setTradeStyle(input: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const { tradeId, style } = setTradeStyleSchema.parse(input);
    const owned = await db
      .select({ id: trades.id })
      .from(trades)
      .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
      .where(and(eq(trades.id, tradeId), eq(tradingAccounts.userId, user.id)))
      .limit(1);
    if (owned.length === 0) return { ok: false, error: "Trade not found." };
    await db
      .update(trades)
      .set({ style, styleSource: "manual" })
      .where(eq(trades.id, tradeId));
    revalidateStrategies();
    return { ok: true, data: null };
  } catch (error) {
    return onActionError(error);
  }
}
