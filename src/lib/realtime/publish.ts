/**
 * Realtime publish hook (spec §5.1.8) — fire-and-forget AFTER the durable
 * commit; never fails or slows the ingest request. Task 11 wires Pusher here
 * behind the env flag; until then it is a structured no-op (§19 graceful
 * fallback).
 */
import { logInfo } from "@/lib/logger";
import type { IngestEventType } from "@/lib/ingest/schemas";

export interface PublishTradeUpdateArgs {
  accountId: string;
  type: IngestEventType;
  tradeId: string | null;
}

export async function publishTradeUpdate(args: PublishTradeUpdateArgs): Promise<void> {
  // Feature flag (§19): Pusher env absent ⇒ nothing to do.
  if (!process.env.PUSHER_KEY) return;
  logInfo("realtime", "publish skipped until Pusher wiring (task 11)", {
    accountId: args.accountId,
    type: args.type,
    tradeId: args.tradeId,
  });
}
