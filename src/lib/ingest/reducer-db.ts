/**
 * Thin DB layer around the pure reducer (spec §5.1.6–7, task 05).
 *
 * One transaction per event: idempotency insert → account touch → snapshot
 * throttle → type dispatch. The ROLLBACK rule: the `trade_events` row is the
 * first write, so any downstream failure rolls the event log back too and the
 * EA's retry re-processes cleanly (§0.8, §19 idempotency-by-deal-ticket).
 */
import { and, desc, eq } from "drizzle-orm";
import { Decimal } from "decimal.js";

import { db } from "@/db/client";
import {
  balanceSnapshots,
  cashOperations,
  magicStrategyMap,
  strategies,
  tradeDeals,
  tradeEvents,
  tradingAccounts,
  trades,
  type TradingAccount,
  type TradeStyle,
} from "@/db/schema";

import {
  computeTradePatch,
  deriveCashOpType,
  fillPriceOnce,
  type ReducerDeal,
} from "./reducer";
import { assignStrategy, type MagicMap } from "./strategy-assignment";
import { epochToDate, priceOrNull, type IngestEvent } from "./schemas";

export type ApplyResult =
  { duplicate: true; tradeId: null } | { duplicate: false; tradeId: string | null };

/** Max one snapshot per 30 s per account (spec §4.3 balance_snapshots). */
const SNAPSHOT_THROTTLE_MS = 30_000;

const money = (n: number): string => new Decimal(n).toFixed(2);
const price5 = (n: number): string => new Decimal(n).toFixed(5);
const volume2 = (n: number): string => new Decimal(n).toFixed(2);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function applyIngestEvent(
  event: IngestEvent,
  account: TradingAccount,
  now: Date,
): Promise<ApplyResult> {
  return db.transaction(async (tx) => {
    // §5.1.6 — idempotency insert-first; empty returning ⇒ duplicate.
    const inserted = await tx
      .insert(tradeEvents)
      .values({
        accountId: account.id,
        eventId: event.eventId,
        type: event.type,
        payload: event,
        receivedAt: now,
      })
      .onConflictDoNothing({ target: [tradeEvents.accountId, tradeEvents.eventId] })
      .returning({ id: tradeEvents.id });
    if (inserted.length === 0) {
      return { duplicate: true, tradeId: null };
    }

    // §5.1.5 first-use binding + §5.1.7 account touch on every event.
    // The EA-reported identity is the SOURCE OF TRUTH (ADR 0007):
    //   broker/currency/isDemo — refreshed every event (no uniqueness risk);
    //   login/server — the binding pair: a bound row adopts it whenever it
    //   differs, UNLESS another row of the same user already carries that
    //   login+server (conflict → skip, never duplicate the unique pair;
    //   resolve the double manually in Accounts). Attaching MT5 therefore
    //   makes the journal account become that exact login+server.
    const loginServerChanged =
      account.login === null ||
      account.login !== event.account.login ||
      account.server !== event.account.server;
    let adoptLoginServer = false;
    if (loginServerChanged) {
      const siblings = await tx
        .select({ id: tradingAccounts.id })
        .from(tradingAccounts)
        .where(
          and(
            eq(tradingAccounts.userId, account.userId),
            eq(tradingAccounts.login, event.account.login),
            eq(tradingAccounts.server, event.account.server),
          ),
        )
        .limit(2);
      adoptLoginServer = !siblings.some((s) => s.id !== account.id);
    }

    await tx
      .update(tradingAccounts)
      .set({
        lastSeenAt: now,
        lastBalance: money(event.account.balance),
        lastEquity: money(event.account.equity),
        broker: event.account.company ?? null,
        currency: event.account.currency,
        isDemo: event.account.isDemo,
        ...(loginServerChanged && adoptLoginServer
          ? {
              login: event.account.login,
              server: event.account.server,
            }
          : {}),
      })
      .where(eq(tradingAccounts.id, account.id));

    await maybeWriteSnapshot(tx, account.id, event, now);

    switch (event.type) {
      case "heartbeat":
      case "snapshot":
        return { duplicate: false, tradeId: null };
      case "cash_op": {
        await applyCashOp(tx, account.id, event);
        return { duplicate: false, tradeId: null };
      }
      case "position_modify":
        return {
          duplicate: false,
          tradeId: await applyPositionModify(tx, account.id, event),
        };
      case "deal_open":
      case "deal_close":
        return { duplicate: false, tradeId: await applyDealEvent(tx, account, event) };
    }
  });
}

async function maybeWriteSnapshot(
  tx: Tx,
  accountId: string,
  event: IngestEvent,
  now: Date,
): Promise<void> {
  const [last] = await tx
    .select({ recordedAt: balanceSnapshots.recordedAt })
    .from(balanceSnapshots)
    .where(eq(balanceSnapshots.accountId, accountId))
    .orderBy(desc(balanceSnapshots.recordedAt))
    .limit(1);

  if (last && now.getTime() - last.recordedAt.getTime() < SNAPSHOT_THROTTLE_MS) {
    return;
  }
  await tx.insert(balanceSnapshots).values({
    accountId,
    balance: money(event.account.balance),
    equity: money(event.account.equity),
    margin: money(event.account.margin),
    recordedAt: now,
  });
}

async function applyCashOp(
  tx: Tx,
  accountId: string,
  event: IngestEvent,
): Promise<void> {
  const deal = event.deal;
  if (!deal) return; // refine guarantees presence; keeps types honest
  await tx
    .insert(cashOperations)
    .values({
      accountId,
      dealId: deal.dealId,
      amount: money(deal.profit),
      type: deriveCashOpType(deal.profit),
      comment: event.position?.comment ?? null,
      timeUtc: epochToDate(deal.timeUtc),
    })
    .onConflictDoNothing({ target: [cashOperations.accountId, cashOperations.dealId] });
}

/** sl/tp only; initial_* filled from the event when unset (§5.1.7). */
async function applyPositionModify(
  tx: Tx,
  accountId: string,
  event: IngestEvent,
): Promise<string | null> {
  const position = event.position;
  if (!position) return null;

  const [trade] = await tx
    .select()
    .from(trades)
    .where(
      and(eq(trades.accountId, accountId), eq(trades.positionId, position.positionId)),
    )
    .for("update");
  if (!trade) return null; // unknown position — modify cannot create one

  const incomingSl = priceOrNull(position.sl);
  const incomingTp = priceOrNull(position.tp);
  await tx
    .update(trades)
    .set({
      sl: incomingSl,
      tp: incomingTp,
      initialSl: fillPriceOnce(trade.initialSl, incomingSl),
      initialTp: fillPriceOnce(trade.initialTp, incomingTp),
    })
    .where(eq(trades.id, trade.id));
  return trade.id;
}

/** deal_open / deal_close — upsert trade by (account, position), recomputing
 *  the full patch from ALL deals afterwards (§19). Creates a stub when the
 *  close arrived first; out-of-order heals on the later deal_open. */
async function applyDealEvent(
  tx: Tx,
  account: TradingAccount,
  event: IngestEvent,
): Promise<string | null> {
  const { id: accountId, userId } = account;
  const position = event.position;
  const deal = event.deal;
  if (!position || !deal) return null;

  let [trade] = await tx
    .select()
    .from(trades)
    .where(
      and(eq(trades.accountId, accountId), eq(trades.positionId, position.positionId)),
    )
    .for("update");

  if (!trade) {
    const created = await tx
      .insert(trades)
      .values({
        accountId,
        positionId: position.positionId,
        symbol: position.symbol,
        direction: position.direction,
        status: "open",
        openedAt: epochToDate(deal.timeUtc),
        sl: priceOrNull(position.sl),
        tp: priceOrNull(position.tp),
        initialSl: priceOrNull(position.sl),
        initialTp: priceOrNull(position.tp),
        balanceAtOpen: money(event.account.balance),
        mt5Comment: position.comment ?? null,
        mt5Magic: position.magic ?? null,
        styleSource: "auto",
      })
      .onConflictDoNothing({ target: [trades.accountId, trades.positionId] })
      .returning();
    trade = created[0];
    if (!trade) {
      // Concurrent writer won the race — re-read under lock.
      [trade] = await tx
        .select()
        .from(trades)
        .where(
          and(
            eq(trades.accountId, accountId),
            eq(trades.positionId, position.positionId),
          ),
        )
        .for("update");
    }
    if (!trade) return null;
  }

  await tx
    .insert(tradeDeals)
    .values({
      tradeId: trade.id,
      accountId,
      dealId: deal.dealId,
      orderId: deal.orderId ?? null,
      entry: deal.entry,
      price: price5(deal.price),
      volume: volume2(deal.volume),
      profit: money(deal.profit),
      commission: money(deal.commission),
      swap: money(deal.swap),
      fee: money(deal.fee),
      timeUtc: epochToDate(deal.timeUtc),
      reason: deal.reason ?? null,
    })
    .onConflictDoNothing({ target: [tradeDeals.accountId, tradeDeals.dealId] });

  // Strategy assignment only when the trade has none yet (§5.1.7). Precedence:
  // magic map → S:comment code → account default (ADR 0009) → unassigned.
  let strategyId = trade.strategyId;
  let strategyRowsForStyle: {
    id: string;
    code: string;
    defaultStyle: TradeStyle | null;
  }[] = [];
  const needsAssignment =
    !strategyId &&
    (position.magic !== undefined || !!position.comment || !!account.defaultStrategyId);
  if (needsAssignment) {
    const [mapRows, strategyRows] = await Promise.all([
      tx
        .select({
          magic: magicStrategyMap.magic,
          strategyId: magicStrategyMap.strategyId,
        })
        .from(magicStrategyMap)
        .where(eq(magicStrategyMap.accountId, accountId)),
      tx
        .select({
          id: strategies.id,
          code: strategies.code,
          defaultStyle: strategies.defaultStyle,
        })
        .from(strategies)
        .where(eq(strategies.userId, userId)),
    ]);
    const magicMap: MagicMap = new Map(
      mapRows.map((row) => [row.magic, row.strategyId]),
    );
    strategyRowsForStyle = strategyRows;
    strategyId = assignStrategy({
      magic: position.magic ?? null,
      comment: position.comment ?? null,
      magicMap,
      strategies: strategyRows,
      defaultStrategyId: account.defaultStrategyId,
    }).strategyId;
  }

  // Open trades carry the account default style (owner request, 2026-11),
  // else the strategy default, else "day" (§9); closed ones are decided by
  // the pure patch (account default → time classifier, unless manual).
  const openStyle: TradeStyle =
    account.defaultStyle ??
    strategyRowsForStyle.find((row) => row.id === strategyId)?.defaultStyle ??
    "day";

  const dealRows = await tx
    .select({
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
    .where(eq(tradeDeals.tradeId, trade.id));

  const reducerDeals: ReducerDeal[] = dealRows.map((row) => ({
    entry: row.entry,
    // Nullable numeric columns — absent values act as zero in the reducer.
    price: row.price ?? "0",
    volume: row.volume ?? "0",
    profit: row.profit ?? "0",
    commission: row.commission ?? "0",
    swap: row.swap ?? "0",
    fee: row.fee ?? "0",
    timeUtc: row.timeUtc,
    reason: row.reason,
  }));

  const patch = computeTradePatch({
    direction: trade.direction,
    deals: reducerDeals,
    currentInitialSl: trade.initialSl,
    currentInitialTp: trade.initialTp,
    currentSl: trade.sl,
    currentTp: trade.tp,
    incomingSl: priceOrNull(position.sl),
    incomingTp: priceOrNull(position.tp),
    tickValue: position.tickValue ?? null,
    tickSize: position.tickSize ?? null,
    styleSource: trade.styleSource,
    currentStyle: trade.style,
    accountDefaultStyle: account.defaultStyle ?? null,
  });

  const finalStyle: TradeStyle | null =
    trade.styleSource === "manual" ? trade.style : (patch.style ?? openStyle);

  await tx
    .update(trades)
    .set({
      status: patch.status,
      openedAt: patch.openedAt ?? trade.openedAt,
      closedAt: patch.closedAt,
      volumeOpened: patch.volumeOpened,
      volumeClosed: patch.volumeClosed,
      avgEntryPrice: patch.avgEntryPrice,
      avgExitPrice: patch.avgExitPrice,
      sl: patch.sl,
      tp: patch.tp,
      initialSl: patch.initialSl,
      initialTp: patch.initialTp,
      grossProfit: patch.grossProfit,
      commission: patch.commission,
      swap: patch.swap,
      fee: patch.fee,
      netProfit: patch.netProfit,
      balanceAtOpen: trade.balanceAtOpen ?? money(event.account.balance),
      balanceAtClose:
        patch.status === "closed"
          ? (trade.balanceAtClose ?? money(event.account.balance))
          : null,
      riskAmount: patch.riskAmount,
      rMultiple: patch.rMultiple,
      pipsOrPoints: patch.pipsOrPoints,
      durationSeconds: patch.durationSeconds,
      strategyId,
      style: finalStyle,
      closeReason: patch.closeReason,
    })
    .where(eq(trades.id, trade.id));

  return trade.id;
}
