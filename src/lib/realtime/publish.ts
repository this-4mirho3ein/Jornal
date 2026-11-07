/**
 * Realtime publish (spec §6.5.1) — fire-and-forget AFTER the durable commit;
 * never fails or slows the ingest request. Flag off (§19) ⇒ silent no-op and
 * clients run the 5 s polling fallback.
 */
import { logError, logInfo } from "@/lib/logger";
import type { IngestEventType } from "@/lib/ingest/schemas";
import { userChannelName } from "@/lib/realtime/channel";
import { TRADE_UPDATED_EVENT, type TradeUpdatePayload, type TradeUpdateSummary } from "@/lib/realtime/payload";
import { getPusherServer } from "@/lib/realtime/server";

export interface PublishTradeUpdateArgs {
  userId: string;
  accountId: string;
  type: IngestEventType;
  tradeId: string | null;
  /** Toast summary lifted from the validated event (null for heartbeats etc.). */
  trade: TradeUpdateSummary | null;
}

export async function publishTradeUpdate(args: PublishTradeUpdateArgs): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;

  const payload: TradeUpdatePayload = {
    accountId: args.accountId,
    tradeId: args.tradeId,
    type: args.type,
    trade: args.trade,
  };
  try {
    await pusher.trigger(userChannelName(args.userId), TRADE_UPDATED_EVENT, payload);
    logInfo("realtime", "published trade.updated", {
      accountId: args.accountId,
      type: args.type,
      tradeId: args.tradeId,
    });
  } catch (err) {
    // Pusher outage must never take the ingest pipeline down (§5.1.8).
    logError("realtime", "publish failed (non-fatal)", err, { accountId: args.accountId });
  }
}
