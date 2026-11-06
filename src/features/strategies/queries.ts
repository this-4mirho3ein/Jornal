import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { magicStrategyMap, strategies, tradingAccounts } from "@/db/schema";

/**
 * All strategies of the user. Active first (creation order), archived last —
 * the UI renders them dimmed with a Restore action.
 */
export async function getUserStrategies(
  userId: string,
  opts: { includeArchived?: boolean } = {},
) {
  const conditions = opts.includeArchived
    ? eq(strategies.userId, userId)
    : and(eq(strategies.userId, userId), isNull(strategies.archivedAt));
  return db
    .select()
    .from(strategies)
    .where(conditions)
    .orderBy(
      sql`${strategies.archivedAt} asc nulls first`,
      asc(strategies.createdAt),
    );
}

export interface MagicMappingRow {
  accountId: string;
  accountName: string;
  magic: number;
  strategyId: string;
  strategyName: string;
  strategyColor: string | null;
}

/**
 * Every magic→strategy mapping of the user, joined with account + strategy
 * names for display. Mappings of archived accounts are hidden (they cannot
 * receive events while archived).
 */
export async function getMagicMappings(userId: string): Promise<MagicMappingRow[]> {
  return db
    .select({
      accountId: magicStrategyMap.accountId,
      accountName: tradingAccounts.displayName,
      magic: magicStrategyMap.magic,
      strategyId: magicStrategyMap.strategyId,
      strategyName: strategies.name,
      strategyColor: strategies.color,
    })
    .from(magicStrategyMap)
    .innerJoin(
      tradingAccounts,
      eq(magicStrategyMap.accountId, tradingAccounts.id),
    )
    .innerJoin(strategies, eq(magicStrategyMap.strategyId, strategies.id))
    .where(
      and(
        eq(tradingAccounts.userId, userId),
        isNull(tradingAccounts.archivedAt),
      ),
    )
    .orderBy(asc(tradingAccounts.displayName), asc(magicStrategyMap.magic));
}
