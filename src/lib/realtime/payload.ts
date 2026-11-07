/**
 * Client/server shared types for the `trade.updated` channel event
 * (spec §6.5). The toast summary travels with the event, so the client
 * never needs a follow-up fetch to say "New trade: XAUUSD Buy @ 2321.35".
 */

/** Display-only snapshot lifted from the validated ingest event itself. */
export interface TradeUpdateSummary {
  symbol: string;
  direction: "buy" | "sell";
  price: number | null;
  profit: number | null;
}

export interface TradeUpdatePayload {
  accountId: string;
  tradeId: string | null;
  type: string;
  trade: TradeUpdateSummary | null;
}

/** Pusher channel event name (§6.5.1). */
export const TRADE_UPDATED_EVENT = "trade.updated";

/** Browser CustomEvent the provider dispatches so list rows can flash. */
export const TRADE_UPDATED_UI_EVENT = "tj:trade-updated";
