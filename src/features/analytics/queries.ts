import { sql, type SQL } from "drizzle-orm";
import { cacheTag } from "next/cache";

import { db } from "@/db/client";
import { dashboardCacheTag } from "@/features/dashboard/queries";

function rawRows<T>(result: unknown): T[] {
  const maybe = result as { rows?: T[] };
  return maybe.rows ?? (result as unknown as T[]);
}

export interface BreakdownRow {
  label: string;
  net: string;
  n: number;
  wins: number;
  avgR: string | null;
}

export interface Breakdowns {
  byStrategy: BreakdownRow[];
  bySymbol: BreakdownRow[];
  byStyle: BreakdownRow[];
  byWeekday: BreakdownRow[];
  byHour: BreakdownRow[];
}

export type BreakdownKind = "strategy" | "symbol" | "style" | "weekday" | "hour";

function labelExpr(kind: BreakdownKind, timezone: string): SQL {
  switch (kind) {
    case "strategy":
      return sql`coalesce(s.name, ${"Unassigned"})`;
    case "symbol":
      return sql`t.symbol`;
    case "style":
      return sql`coalesce(t.style::text, ${"unclassified"})`;
    case "weekday":
      return sql`extract(isodow from t.closed_at at time zone ${timezone})::int::text`;
    case "hour":
      return sql`lpad(extract(hour from t.closed_at at time zone ${timezone})::int::text, 2, ${"0"})`;
  }
}

/**
 * Closed-trade breakdown (§10) keyed in the ACCOUNT timezone, plain numeric
 * aggregates straight from SQL. `avgR` is null when no R is known.
 */
export async function getBreakdown(
  userId: string,
  accountId: string | null,
  startIso: string | null,
  timezone: string,
  kind: BreakdownKind,
): Promise<BreakdownRow[]> {
  "use cache";
  cacheTag(dashboardCacheTag(userId, accountId));
  const label = labelExpr(kind, timezone);
  const accountCond = accountId ? sql` and a.id = ${accountId}` : sql``;
  const startCond = startIso ? sql` and t.closed_at >= ${startIso}` : sql``;
  const result = await db.execute(sql`
    select ${label} as label,
           coalesce(sum(t.net_profit), 0)::text as net,
           count(*)::int as n,
           count(*) filter (where t.net_profit > 0)::int as wins,
           avg(t.r_multiple)::text as avg_r
    from trades t
    join trading_accounts a on a.id = t.account_id
    left join strategies s on s.id = t.strategy_id
    where a.user_id = ${userId} and t.status = 'closed'
      ${accountCond}${startCond}
    group by 1
    order by sum(t.net_profit) desc
    limit 20
  `);
  return rawRows<{
    label: string;
    net: string;
    n: number;
    wins: number;
    avg_r: string | null;
  }>(result).map((row) => ({
    label: String(row.label),
    net: String(row.net),
    n: Number(row.n),
    wins: Number(row.wins),
    avgR: row.avg_r === null ? null : Number(Number(row.avg_r).toFixed(2)).toString(),
  }));
}

export async function getBreakdowns(
  userId: string,
  accountId: string | null,
  startIso: string | null,
  timezone: string,
): Promise<Breakdowns> {
  const [byStrategy, bySymbol, byStyle, byWeekday, byHour] = await Promise.all([
    getBreakdown(userId, accountId, startIso, timezone, "strategy"),
    getBreakdown(userId, accountId, startIso, timezone, "symbol"),
    getBreakdown(userId, accountId, startIso, timezone, "style"),
    getBreakdown(userId, accountId, startIso, timezone, "weekday"),
    getBreakdown(userId, accountId, startIso, timezone, "hour"),
  ]);
  return { byStrategy, bySymbol, byStyle, byWeekday, byHour };
}

export interface StyleCompareRow {
  style: string;
  n: number;
  wins: number;
  net: string;
  avgR: string | null;
  avgDurationSeconds: number | null;
  winRate: number | null;
  profitFactor: string | null;
}

/** §9 — scalp vs swing (and every other style) side by side. */
export async function getStyleCompare(
  userId: string,
  accountId: string | null,
  startIso: string | null,
): Promise<StyleCompareRow[]> {
  "use cache";
  cacheTag(dashboardCacheTag(userId, accountId));
  const accountCond = accountId ? sql` and a.id = ${accountId}` : sql``;
  const startCond = startIso ? sql` and t.closed_at >= ${startIso}` : sql``;
  const result = await db.execute(sql`
    select coalesce(t.style::text, 'unclassified') as style,
           count(*)::int as n,
           count(*) filter (where t.net_profit > 0)::int as wins,
           coalesce(sum(t.net_profit), 0)::text as net,
           avg(t.r_multiple)::text as avg_r,
           avg(t.duration_seconds)::text as avg_duration,
           coalesce(sum(t.net_profit) filter (where t.net_profit > 0), 0)::text as gross_win,
           coalesce(sum(t.net_profit) filter (where t.net_profit < 0), 0)::text as gross_loss
    from trades t
    join trading_accounts a on a.id = t.account_id
    where a.user_id = ${userId} and t.status = 'closed'
      ${accountCond}${startCond}
    group by 1 order by 2 desc
  `);
  return rawRows<{
    style: string;
    n: number;
    wins: number;
    net: string;
    avg_r: string | null;
    avg_duration: string | null;
    gross_win: string;
    gross_loss: string;
  }>(result).map((row) => {
    const decided = Number(row.wins);
    const n = Number(row.n);
    const grossWin = Number(row.gross_win);
    const grossLoss = Number(row.gross_loss);
    return {
      style: String(row.style),
      n,
      wins: decided,
      net: String(row.net),
      avgR: row.avg_r === null ? null : Number(Number(row.avg_r).toFixed(2)).toString(),
      avgDurationSeconds:
        row.avg_duration === null ? null : Math.round(Number(row.avg_duration)),
      winRate: decided > 0 ? Math.round((decided / n) * 1000) / 10 : null,
      profitFactor: grossLoss < 0 ? (grossWin / Math.abs(grossLoss)).toFixed(2) : null,
    };
  });
}

export interface RDistribution {
  label: string;
  n: number;
}

/** Histogram buckets for closed-trade R multiples (§10). */
export async function getRDistribution(
  userId: string,
  accountId: string | null,
  startIso: string | null,
): Promise<RDistribution[]> {
  "use cache";
  cacheTag(dashboardCacheTag(userId, accountId));
  const accountCond = accountId ? sql` and a.id = ${accountId}` : sql``;
  const startCond = startIso ? sql` and t.closed_at >= ${startIso}` : sql``;
  const result = await db.execute(sql`
    select
      count(*) filter (where t.r_multiple <= -2)::int as b0,
      count(*) filter (where t.r_multiple > -2 and t.r_multiple <= -1)::int as b1,
      count(*) filter (where t.r_multiple > -1 and t.r_multiple < 0)::int as b2,
      count(*) filter (where t.r_multiple >= 0 and t.r_multiple < 1)::int as b3,
      count(*) filter (where t.r_multiple >= 1 and t.r_multiple < 2)::int as b4,
      count(*) filter (where t.r_multiple >= 2 and t.r_multiple < 3)::int as b5,
      count(*) filter (where t.r_multiple >= 3)::int as b6
    from trades t
    join trading_accounts a on a.id = t.account_id
    where a.user_id = ${userId} and t.status = 'closed' and t.r_multiple is not null
      ${accountCond}${startCond}
  `);
  const row = rawRows<Record<string, number>>(result)[0] ?? {};
  const labels = ["≤ −2R", "−2…−1R", "−1…0R", "0…1R", "1…2R", "2…3R", "≥ 3R"];
  return labels.map((label, index) => ({
    label,
    n: Number(row[`b${index}`] ?? 0),
  }));
}

export interface WinLossBe {
  wins: number;
  losses: number;
  breakeven: number;
  net: string;
}

/**
 * Win / loss / breakeven counts for the analytics donut (closed trades only,
 * same period semantics as getRDistribution; BE = net_profit === 0, matching
 * the win-rate `decided` handling in getStyleCompare).
 */
export async function getWinLossBe(
  userId: string,
  accountId: string | null,
  startIso: string | null,
): Promise<WinLossBe> {
  "use cache";
  cacheTag(dashboardCacheTag(userId, accountId));
  const accountCond = accountId ? sql` and a.id = ${accountId}` : sql``;
  const startCond = startIso ? sql` and t.closed_at >= ${startIso}` : sql``;
  const result = await db.execute(sql`
    select
      count(*) filter (where t.net_profit > 0)::int as wins,
      count(*) filter (where t.net_profit = 0)::int as be,
      count(*) filter (where t.net_profit < 0)::int as losses,
      coalesce(sum(t.net_profit), 0)::text as net
    from trades t
    join trading_accounts a on a.id = t.account_id
    where a.user_id = ${userId} and t.status = 'closed'
      ${accountCond}${startCond}
  `);
  const row = rawRows<Record<string, number | string>>(result)[0] ?? {};
  return {
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    breakeven: Number(row.be ?? 0),
    net: String(row.net ?? "0"),
  };
}
