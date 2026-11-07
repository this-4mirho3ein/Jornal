import { and, asc, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { cacheTag, revalidateTag } from "next/cache";

import { db } from "@/db/client";
import { balanceSnapshots, strategies, trades, tradingAccounts } from "@/db/schema";
import { getActiveAccount } from "@/features/accounts/active-account";
import { parseDashboardPeriod, type DashboardPeriod } from "@/lib/metrics";

export type { DashboardPeriod };
export { parseDashboardPeriod };

/** Cache tag shared by every dashboard/analytics widget (§13 cacheTag). */
export function dashboardCacheTag(userId: string, accountId: string | null): string {
  return `dashboard:${userId}:${accountId ?? "all"}`;
}

/** Called by the ingest pipeline after a durable commit (task 10 wiring). */
export function revalidateDashboardCache(userId: string, accountId: string): void {
  // expire: 0 → the next viewer blocks on fresh data; correctness > latency.
  revalidateTag(dashboardCacheTag(userId, accountId), { expire: 0 });
  revalidateTag(dashboardCacheTag(userId, null), { expire: 0 });
}

export interface DashboardScope {
  userId: string;
  accountId: string | null;
  timezone: string;
  currency: string;
}

/** Same active-account resolution as the trades list (§8.1). */
export async function resolveDashboardScope(
  userId: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<DashboardScope> {
  const active = await getActiveAccount(userId, Promise.resolve(searchParams));
  return {
    userId,
    accountId: active.account?.id ?? null,
    timezone: active.account?.timezone ?? "UTC",
    currency: active.account?.currency ?? "USD",
  };
}

function rawRows<T>(result: unknown): T[] {
  const maybe = result as { rows?: T[] };
  return maybe.rows ?? (result as unknown as T[]);
}

/** Window: closed trades within the period, plus currently-open ones. */
function periodCondition(startIso: string | null): SQL {
  if (!startIso) return sql`true`;
  return sql`((${trades.status} = 'closed' and ${trades.closedAt} >= ${startIso}) or ${trades.status} = 'open')`;
}

export interface DashboardKpis {
  closed: number;
  open: number;
  net: string;
  wins: number;
  losses: number;
  breakeven: number;
  grossWin: string;
  grossLoss: string;
  avgR: string | null;
  best: string | null;
  worst: string | null;
}

/** §10 KPI row — SQL-aggregated over closed trades in-period. */
export async function getDashboardKpis(
  userId: string,
  accountId: string | null,
  startIso: string | null,
): Promise<DashboardKpis> {
  "use cache";
  const tag = dashboardCacheTag(userId, accountId);
  cacheTag(tag);
  const conds: SQL[] = [eq(tradingAccounts.userId, userId)];
  if (accountId) conds.push(eq(trades.accountId, accountId));
  conds.push(periodCondition(startIso));
  const [row] = await db
    .select({
      closed: sql<number>`count(*) filter (where ${trades.status} = 'closed')::int`,
      open: sql<number>`count(*) filter (where ${trades.status} = 'open')::int`,
      net: sql<string>`coalesce(sum(${trades.netProfit}) filter (where ${trades.status} = 'closed'), 0)::text`,
      wins: sql<number>`count(*) filter (where ${trades.status} = 'closed' and ${trades.netProfit} > 0)::int`,
      losses: sql<number>`count(*) filter (where ${trades.status} = 'closed' and ${trades.netProfit} < 0)::int`,
      breakeven: sql<number>`count(*) filter (where ${trades.status} = 'closed' and ${trades.netProfit} = 0)::int`,
      grossWin: sql<string>`coalesce(sum(${trades.netProfit}) filter (where ${trades.status} = 'closed' and ${trades.netProfit} > 0), 0)::text`,
      grossLoss: sql<string>`coalesce(sum(${trades.netProfit}) filter (where ${trades.status} = 'closed' and ${trades.netProfit} < 0), 0)::text`,
      avgR: sql<
        string | null
      >`avg(${trades.rMultiple}) filter (where ${trades.status} = 'closed')::text`,
      best: sql<
        string | null
      >`max(${trades.netProfit}) filter (where ${trades.status} = 'closed')::text`,
      worst: sql<
        string | null
      >`min(${trades.netProfit}) filter (where ${trades.status} = 'closed')::text`,
    })
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .where(and(...conds));
  return (
    row ?? {
      closed: 0,
      open: 0,
      net: "0",
      wins: 0,
      losses: 0,
      breakeven: 0,
      grossWin: "0",
      grossLoss: "0",
      avgR: null,
      best: null,
      worst: null,
    }
  );
}

/** Chronological closed trades (streaks/expectancy via lib/metrics). */
export async function getClosedTradeLites(
  userId: string,
  accountId: string | null,
  startIso: string | null,
): Promise<Array<{ netProfit: string | null; rMultiple: string | null; closedAt: string | null }>> {
  "use cache";
  cacheTag(dashboardCacheTag(userId, accountId));
  const conds: SQL[] = [eq(tradingAccounts.userId, userId), eq(trades.status, "closed")];
  if (accountId) conds.push(eq(trades.accountId, accountId));
  if (startIso) conds.push(gte(trades.closedAt, new Date(startIso)));
  const rows = (await db
    .select({
      netProfit: trades.netProfit,
      rMultiple: trades.rMultiple,
      closedAt: trades.closedAt,
    })
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .where(and(...conds))
    .orderBy(asc(trades.closedAt))
    .limit(4000)) as Array<{
    netProfit: string | null;
    rMultiple: string | null;
    closedAt: Date | null;
  }>;
  return rows.map((r) => ({
    netProfit: r.netProfit,
    rMultiple: r.rMultiple,
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
  }));
}

/** §10 equity curve from the throttled balance_snapshots. */
export async function getEquitySeries(
  userId: string,
  accountId: string | null,
  startIso: string | null,
): Promise<Array<{ t: string; value: string }>> {
  "use cache";
  cacheTag(dashboardCacheTag(userId, accountId));
  const conds: SQL[] = [eq(tradingAccounts.userId, userId)];
  if (accountId) conds.push(eq(balanceSnapshots.accountId, accountId));
  if (startIso) conds.push(gte(balanceSnapshots.recordedAt, new Date(startIso)));
  const rows = (await db
    .select({
      t: balanceSnapshots.recordedAt,
      value: sql<string>`coalesce(${balanceSnapshots.equity}, ${balanceSnapshots.balance})::text`,
    })
    .from(balanceSnapshots)
    .innerJoin(tradingAccounts, eq(balanceSnapshots.accountId, tradingAccounts.id))
    .where(and(...conds))
    .orderBy(asc(balanceSnapshots.recordedAt))
    .limit(1200)) as Array<{ t: Date; value: string }>;
  const mapped = rows.map((row) => ({ t: row.t.toISOString(), value: row.value }));
  // Downsample large ranges for chart Payload size.
  if (mapped.length <= 320) return mapped;
  const stride = Math.ceil(mapped.length / 320);
  return mapped.filter((_, index) => index % stride === 0 || index === mapped.length - 1);
}

/** §12 calendar-heatmap source: daily P/L grouped in the ACCOUNT timezone. */
export async function getDailyPnl(
  userId: string,
  accountId: string | null,
  startIso: string | null,
  timezone: string,
): Promise<Array<{ day: string; pnl: string; n: number }>> {
  "use cache";
  cacheTag(dashboardCacheTag(userId, accountId));
  const accountCond = accountId ? sql` and a.id = ${accountId}` : sql``;
  const startCond = startIso ? sql` and t.closed_at >= ${startIso}` : sql``;
  const result = await db.execute(sql`
    select (t.closed_at at time zone ${timezone})::date::text as day,
           sum(t.net_profit)::text as pnl,
           count(*)::int as n
    from trades t
    join trading_accounts a on a.id = t.account_id
    where a.user_id = ${userId} and t.status = 'closed'
      ${accountCond}${startCond}
    group by 1 order by 1
  `);
  return rawRows<{ day: string; pnl: string; n: number }>(result).map((row) => ({
    day: String(row.day),
    pnl: String(row.pnl),
    n: Number(row.n),
  }));
}

/** Compact recent-trades strip for the dashboard footer (§10). */
export async function getRecentTrades(
  userId: string,
  accountId: string | null,
  limit = 5,
): Promise<
  Array<{
    id: string;
    symbol: string;
    direction: "buy" | "sell";
    status: "open" | "closed";
    openedAt: string | null;
    netProfit: string | null;
    strategyName: string | null;
    strategyColor: string | null;
    style: "scalp" | "day" | "swing" | "position" | null;
  }>
> {
  "use cache";
  cacheTag(dashboardCacheTag(userId, accountId));
  const conds: SQL[] = [eq(tradingAccounts.userId, userId)];
  if (accountId) conds.push(eq(trades.accountId, accountId));
  const rows = (await db
    .select({
      id: trades.id,
      symbol: trades.symbol,
      direction: trades.direction,
      status: trades.status,
      openedAt: trades.openedAt,
      netProfit: trades.netProfit,
      strategyName: strategies.name,
      strategyColor: strategies.color,
      style: trades.style,
    })
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .leftJoin(strategies, eq(trades.strategyId, strategies.id))
    .where(and(...conds))
    .orderBy(sql`${trades.openedAt} desc nulls last`, desc(trades.id))
    .limit(limit)) as Array<{
    id: string;
    symbol: string;
    direction: "buy" | "sell";
    status: "open" | "closed";
    openedAt: Date | null;
    netProfit: string | null;
    strategyName: string | null;
    strategyColor: string | null;
    style: "scalp" | "day" | "swing" | "position" | null;
  }>;
  return rows.map((row) => ({
    ...row,
    openedAt: row.openedAt ? row.openedAt.toISOString() : null,
  }));
}

