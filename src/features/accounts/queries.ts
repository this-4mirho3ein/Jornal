import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { tradingAccounts, type TradingAccount } from "@/db/schema";

/** All accounts of the user (archived excluded unless asked for). */
export async function getUserAccounts(
  userId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<TradingAccount[]> {
  const conditions = opts.includeArchived
    ? eq(tradingAccounts.userId, userId)
    : and(eq(tradingAccounts.userId, userId), isNull(tradingAccounts.archivedAt));
  return db
    .select()
    .from(tradingAccounts)
    .where(conditions)
    .orderBy(asc(tradingAccounts.createdAt));
}

/** Ownership-checked single fetch; null when missing or not owned. */
export async function getAccountById(
  accountId: string,
  userId: string,
): Promise<TradingAccount | null> {
  const rows = await db
    .select()
    .from(tradingAccounts)
    .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * First non-archived account (creation order) — the fallback when neither the
 * URL nor the cookie names a usable account.
 */
export async function getFirstAccount(userId: string): Promise<TradingAccount | null> {
  const rows = await db
    .select()
    .from(tradingAccounts)
    .where(and(eq(tradingAccounts.userId, userId), isNull(tradingAccounts.archivedAt)))
    .orderBy(asc(tradingAccounts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}
