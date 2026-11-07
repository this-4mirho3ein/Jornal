/**
 * prune-mock-trades.ts — removes ALL mock journal data so only real MT5
 * events remain (owner request, 2026-11: the EA has never been connected,
 * so every trade/deal/event row is seed data).
 *
 * Deletes (all accounts): trade_events, balance_snapshots, cash_operations,
 * magic_strategy_map, trade_deals, trades.
 * Resets: accounts.login/server/broker → null and last* → null, so the
 * EA-reported identity binds cleanly on the next event (ADR 0007).
 * Keeps: users, accounts (ingest keys stay valid!), strategies, sessions.
 *
 *   pnpm tsx scripts/prune-mock-trades.ts --yes
 */
import { sql } from "drizzle-orm";

import "@/lib/load-env";

import { db } from "@/db/client";
import {
  balanceSnapshots,
  cashOperations,
  magicStrategyMap,
  tradeDeals,
  tradeEvents,
  tradingAccounts,
  trades,
} from "@/db/schema";

async function main(): Promise<void> {
  const yes = process.argv.includes("--yes");
  const before = await db.execute(sql`
    select
      (select count(*)::int from trades) as trades,
      (select count(*)::int from trade_deals) as deals,
      (select count(*)::int from trade_events) as events,
      (select count(*)::int from balance_snapshots) as snapshots,
      (select count(*)::int from cash_operations) as cash_ops,
      (select count(*)::int from magic_strategy_map) as magic_maps
  `);
  const row = (
    (before as unknown as { rows?: Array<Record<string, number>> }).rows ??
    (before as unknown as Array<Record<string, number>>)
  )[0];
  console.log("Mock data present:", row);
  if (!yes) {
    console.error("Refusing to delete without --yes");
    process.exit(2);
  }

  await db.delete(tradeEvents);
  await db.delete(balanceSnapshots);
  await db.delete(cashOperations);
  await db.delete(magicStrategyMap);
  await db.delete(tradeDeals);
  await db.delete(trades);

  // Identity resets so the EA-reported login/server binds on first contact
  // (pure ADR 0007 roadmap; display names stay for the owner to rename).
  await db
    .update(tradingAccounts)
    .set({
      login: null,
      server: null,
      broker: null,
      lastBalance: null,
      lastEquity: null,
      lastSeenAt: null,
    });

  const after = await db.execute(sql`
    select
      (select count(*)::int from trades) as trades,
      (select count(*)::int from trade_deals) as deals,
      (select count(*)::int from trade_events) as events,
      (select count(*)::int from trading_accounts) as accounts,
      (select count(*)::int from strategies) as strategies
  `);
  const afterRow = (
    (after as unknown as { rows?: Array<Record<string, number>> }).rows ??
    (after as unknown as Array<Record<string, number>>)
  )[0];
  console.log("After prune:", afterRow);
  console.log("PASS: mock journal data removed; accounts + strategies + keys kept.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
