import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  strategies,
  tradeDeals,
  tradeEvents,
  trades,
  tradingAccounts,
} from "@/db/schema";

export interface TradeDetailDeals {
  id: string;
  dealId: number;
  entry: "in" | "out" | "inout" | "out_by";
  price: string | null;
  volume: string | null;
  profit: string | null;
  commission: string | null;
  swap: string | null;
  fee: string | null;
  timeUtc: Date;
  reason: string | null;
}

export interface TradeModifyEvent {
  eventId: string;
  receivedAt: Date;
  sl: number | null;
  tp: number | null;
}

export interface TradeDetail {
  trade: typeof trades.$inferSelect;
  account: {
    id: string;
    displayName: string;
    timezone: string;
    currency: string;
  };
  strategy: { id: string; name: string; color: string | null } | null;
  strategyOptions: Array<{ id: string; name: string; color: string | null }>;
  deals: TradeDetailDeals[];
  modifies: TradeModifyEvent[];
}

/**
 * Full §8.2 payload for one trade, ownership-checked (missing/foreign → null).
 */
export async function getTradeDetail(
  userId: string,
  tradeId: string,
): Promise<TradeDetail | null> {
  const [row] = await db
    .select({
      trade: trades,
      account: {
        id: tradingAccounts.id,
        displayName: tradingAccounts.displayName,
        timezone: tradingAccounts.timezone,
        currency: tradingAccounts.currency,
      },
      strategyId: strategies.id,
      strategyName: strategies.name,
      strategyColor: strategies.color,
    })
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .leftJoin(strategies, eq(trades.strategyId, strategies.id))
    .where(and(eq(trades.id, tradeId), eq(tradingAccounts.userId, userId)))
    .limit(1);
  if (!row) return null;

  const [dealRows, eventRows, strategyRows] = await Promise.all([
    db
      .select({
        id: tradeDeals.id,
        dealId: tradeDeals.dealId,
        entry: tradeDeals.entry,
        price: tradeDeals.price,
        volume: tradeDeals.volume,
        profit: tradeDeals.profit,
        commission: tradeDeals.commission,
        swap: tradeDeals.swap,
        fee: tradeDeals.fee,
        timeUtc: tradeDeals.timeUtc,
        reason: tradeDeals.reason,
      })
      .from(tradeDeals)
      .where(eq(tradeDeals.tradeId, row.trade.id))
      .orderBy(asc(tradeDeals.timeUtc), asc(tradeDeals.dealId)),
    db
      .select({
        eventId: tradeEvents.eventId,
        receivedAt: tradeEvents.receivedAt,
        payload: tradeEvents.payload,
      })
      .from(tradeEvents)
      .where(
        and(
          eq(tradeEvents.accountId, row.trade.accountId),
          eq(tradeEvents.type, "position_modify"),
          sql`${tradeEvents.payload}->'position'->>'positionId' = ${String(row.trade.positionId)}`,
        ),
      )
      .orderBy(asc(tradeEvents.receivedAt))
      .limit(50),
    db
      .select({ id: strategies.id, name: strategies.name, color: strategies.color })
      .from(strategies)
      .where(eq(strategies.userId, userId))
      .orderBy(asc(strategies.name)),
  ]);

  const modifies: TradeModifyEvent[] = eventRows.map((event) => {
    const position = (
      event.payload as { position?: { sl?: number; tp?: number } } | null
    )?.position;
    return {
      eventId: event.eventId,
      receivedAt: event.receivedAt,
      // Wire 0 = none (§4.2)
      sl: position?.sl && position.sl > 0 ? position.sl : null,
      tp: position?.tp && position.tp > 0 ? position.tp : null,
    };
  });

  return {
    trade: row.trade,
    account: row.account,
    strategy: row.strategyId
      ? { id: row.strategyId, name: row.strategyName ?? "", color: row.strategyColor }
      : null,
    strategyOptions: strategyRows,
    deals: dealRows,
    modifies,
  };
}
