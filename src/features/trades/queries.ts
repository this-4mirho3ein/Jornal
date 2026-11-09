import {
  and,
  arrayOverlaps,
  asc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db/client";
import { type TradingAccount, strategies, trades, tradingAccounts } from "@/db/schema";
import { getActiveAccount } from "@/features/accounts/active-account";
import {
  parseTradesFilters,
  type TradesFilters,
  type TradeSort,
  type TradeStyleFilter,
} from "@/features/trades/schemas";

export const TRADES_PAGE_SIZE = 25;
export const TRADES_EXPORT_LIMIT = 5_000;

/** Column projection for the list/export — never `SELECT *` (spec §13). */
const listSelection = {
  id: trades.id,
  positionId: trades.positionId,
  symbol: trades.symbol,
  direction: trades.direction,
  status: trades.status,
  openedAt: trades.openedAt,
  closedAt: trades.closedAt,
  volumeOpened: trades.volumeOpened,
  volumeClosed: trades.volumeClosed,
  avgEntryPrice: trades.avgEntryPrice,
  avgExitPrice: trades.avgExitPrice,
  grossProfit: trades.grossProfit,
  commission: trades.commission,
  swap: trades.swap,
  fee: trades.fee,
  netProfit: trades.netProfit,
  rMultiple: trades.rMultiple,
  durationSeconds: trades.durationSeconds,
  strategyId: trades.strategyId,
  strategyName: strategies.name,
  strategyColor: strategies.color,
  style: trades.style,
  styleSource: trades.styleSource,
  rating: trades.rating,
  mt5Magic: trades.mt5Magic,
  mt5Comment: trades.mt5Comment,
  notes: trades.notes,
  accountName: tradingAccounts.displayName,
  accountTimezone: tradingAccounts.timezone,
};

export interface TradeListRow {
  id: string;
  positionId: number;
  symbol: string;
  direction: "buy" | "sell";
  status: "open" | "closed";
  openedAt: Date | null;
  closedAt: Date | null;
  volumeOpened: string | null;
  volumeClosed: string | null;
  avgEntryPrice: string | null;
  avgExitPrice: string | null;
  grossProfit: string | null;
  commission: string | null;
  swap: string | null;
  fee: string | null;
  netProfit: string | null;
  rMultiple: string | null;
  durationSeconds: number | null;
  strategyId: string | null;
  strategyName: string | null;
  strategyColor: string | null;
  style: TradeStyleFilter | null;
  styleSource: "auto" | "manual";
  rating: number | null;
  mt5Magic: number | null;
  mt5Comment: string | null;
  notes: string | null;
  accountName: string;
  accountTimezone: string;
}

const sortOrder: Record<TradeSort, SQL> = {
  opened_desc: sql`${trades.openedAt} desc nulls last`,
  opened_asc: sql`${trades.openedAt} asc nulls last`,
  closed_desc: sql`${trades.closedAt} desc nulls last`,
  pnl_desc: sql`${trades.netProfit} desc nulls last`,
  pnl_asc: sql`${trades.netProfit} asc nulls last`,
  r_desc: sql`${trades.rMultiple} desc nulls last`,
};

/**
 * ALL filtering happens here (spec §11: never client-side on full data).
 * Ownership is implicit: every trade joins its trading account and the
 * account row must belong to `userId`.
 */
function tradesWhere(userId: string, f: TradesFilters): SQL | undefined {
  const conds: Array<SQL | undefined> = [eq(tradingAccounts.userId, userId)];
  if (f.account) conds.push(eq(trades.accountId, f.account));
  if (f.symbols?.length) conds.push(inArray(trades.symbol, f.symbols));
  if (f.direction) conds.push(eq(trades.direction, f.direction));
  if (f.status) conds.push(eq(trades.status, f.status));
  if (f.result) {
    // Win/loss/be only make sense on closed rows; NULL net never matches.
    conds.push(eq(trades.status, "closed"));
    if (f.result === "win") conds.push(gt(trades.netProfit, "0"));
    else if (f.result === "loss") conds.push(lt(trades.netProfit, "0"));
    else conds.push(sql`(${trades.netProfit} = 0)`);
  }
  if (f.strategies?.length) conds.push(inArray(trades.strategyId, f.strategies));
  if (f.styles?.length) conds.push(inArray(trades.style, f.styles));
  if (f.setups?.length) conds.push(arrayOverlaps(trades.setupTags, f.setups));
  if (f.mistakes?.length) {
    conds.push(arrayOverlaps(trades.mistakeTags, f.mistakes));
  }
  if (f.plMin) conds.push(gte(trades.netProfit, f.plMin));
  if (f.plMax) conds.push(lte(trades.netProfit, f.plMax));
  if (f.rMin) conds.push(gte(trades.rMultiple, f.rMin));
  if (f.rMax) conds.push(lte(trades.rMultiple, f.rMax));
  if (f.rating) conds.push(gte(trades.rating, f.rating));
  if (f.q) {
    const like = `%${f.q}%`;
    conds.push(
      or(
        ilike(trades.symbol, like),
        ilike(trades.mt5Comment, like),
        ilike(trades.notes, like),
      ),
    );
  }
  if (f.from) conds.push(gte(trades.openedAt, new Date(`${f.from}T00:00:00.000Z`)));
  if (f.to) conds.push(lte(trades.openedAt, new Date(`${f.to}T23:59:59.999Z`)));
  return and(...conds);
}

function baseQuery() {
  return db
    .select(listSelection)
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .leftJoin(strategies, eq(trades.strategyId, strategies.id));
}

export interface TradesPage {
  rows: TradeListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function getTradesPage(
  userId: string,
  filters: TradesFilters,
): Promise<TradesPage> {
  const where = tradesWhere(userId, filters);
  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .where(where);
  const rows = (await baseQuery()
    .where(where)
    .orderBy(sortOrder[filters.sort], asc(trades.id))
    .limit(TRADES_PAGE_SIZE)
    .offset((filters.page - 1) * TRADES_PAGE_SIZE)) as TradeListRow[];
  const total = countRow?.total ?? 0;
  return {
    rows,
    total,
    page: filters.page,
    pageSize: TRADES_PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / TRADES_PAGE_SIZE)),
  };
}

/** Full filtered set for CSV export (capped — this is a journal, not a DW). */
export async function getTradesForExport(
  userId: string,
  filters: TradesFilters,
): Promise<TradeListRow[]> {
  return (await baseQuery()
    .where(tradesWhere(userId, filters))
    .orderBy(sortOrder[filters.sort], asc(trades.id))
    .limit(TRADES_EXPORT_LIMIT)) as TradeListRow[];
}

export interface TradeFacets {
  symbols: string[];
  setupTags: Array<{ tag: string; count: number }>;
  mistakeTags: Array<{ tag: string; count: number }>;
}

export interface ResolvedTrades {
  /** Filters with `account` normalized to the active-account resolution. */
  filters: TradesFilters;
  /** Resolved account (null = "All accounts" aggregate view). */
  accountId: string | null;
  /** Every non-archived account — lets pages render no-account states. */
  accounts: TradingAccount[];
  timezone: string;
  facets: TradeFacets;
}

/**
 * The one entry pages AND the export route call: parses URL params, applies
 * the global active-account resolution (URL `?account=` wins, then the
 * `tj_account` cookie, then the first account — all ownership-validated by
 * `getActiveAccount`), and loads the facet options for the filter UI.
 */
export async function resolveTradesView(
  userId: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ResolvedTrades> {
  const active = await getActiveAccount(userId, Promise.resolve(searchParams));
  const parsed = parseTradesFilters(searchParams);
  const accountId = active.account?.id ?? undefined;
  const filters: TradesFilters = { ...parsed, account: accountId };
  const accountIdCond = accountId ? eq(trades.accountId, accountId) : undefined;
  const scope = [eq(tradingAccounts.userId, userId), accountIdCond];

  const symbolRows = await db
    .selectDistinct({ symbol: trades.symbol })
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .where(and(...scope))
    .orderBy(asc(trades.symbol))
    .limit(200);

  return {
    filters,
    accountId: accountId ?? null,
    accounts: active.accounts,
    timezone: active.account?.timezone ?? "UTC",
    facets: {
      symbols: symbolRows.map((r) => r.symbol),
      setupTags: await tagFacets(userId, accountId, "setup"),
      mistakeTags: await tagFacets(userId, accountId, "mistake"),
    },
  };
}

/** Distinct tags via unnest, most-used first (drizzle has no unnest helper). */
async function tagFacets(
  userId: string,
  accountId: string | undefined,
  kind: "setup" | "mistake",
): Promise<Array<{ tag: string; count: number }>> {
  const column = kind === "setup" ? sql.raw("t.setup_tags") : sql.raw("t.mistake_tags");
  const accountCond = accountId ? sql` and a.id = ${accountId}` : sql``;
  const result = await db.execute(
    sql`select unnest(${column}) as tag, count(*)::int as n
        from trades t
        join trading_accounts a on a.id = t.account_id
        where a.user_id = ${userId} and ${column} <> '{}'${accountCond}
        group by 1 order by 2 desc, 1 asc limit 40`,
  );
  // node-postgres returns { rows }, the Neon driver returns arrays — accept both.
  const raw =
    (result as unknown as { rows?: Array<{ tag: string; n: number }> }).rows ??
    (result as unknown as Array<{ tag: string; n: number }>);
  return raw.map((r) => ({ tag: String(r.tag), count: Number(r.n) }));
}
