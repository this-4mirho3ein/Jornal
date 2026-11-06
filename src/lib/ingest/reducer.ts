/**
 * Pure ingest reducer core (spec §5.1.7, §19 — "the reducer is where
 * correctness lives"). No DB, no I/O: takes the position's deals (as stored,
 * numeric strings) plus the event context and returns the trades-row patch.
 *
 * Invariants proven by src/tests/unit/ingest/ and enforced here:
 *  - aggregates are ALWAYS recomputed from `trade_deals` (self-healing,
 *    order-independent — never incrementally mutated);
 *  - initial_sl/initial_tp are the FIRST values ever seen (§4.1) — filled
 *    only when unset, never overwritten;
 *  - a position is closed when entry volume ≈ exit volume;
 *  - all money math is decimal.js — floats never participate (§0.7).
 */
import { Decimal } from "decimal.js";

import type {
  DealEntryValue,
  DealReasonValue,
  DirectionValue,
} from "@/lib/ingest/schemas";
import {
  classifyStyle,
  isSameTradingDay,
  type TradeStyleValue,
} from "@/lib/trade-style";

/** A deal as stored in `trade_deals` (numeric strings, DB-shaped). */
export interface ReducerDeal {
  entry: DealEntryValue;
  price: string | null;
  volume: string;
  profit: string;
  commission: string;
  swap: string;
  fee: string;
  timeUtc: Date;
  reason: DealReasonValue | null;
}

export interface TradePatchInput {
  direction: DirectionValue;
  deals: readonly ReducerDeal[];
  currentInitialSl: string | null;
  currentInitialTp: string | null;
  /** Current live SL/TP — only filled when unset by deal events. */
  currentSl: string | null;
  currentTp: string | null;
  /** Event position values (already `0 → null`). */
  incomingSl: string | null;
  incomingTp: string | null;
  /** §10: exact risk via EA tick values; absent ⇒ risk/r stay null. */
  tickValue: number | null;
  tickSize: number | null;
  styleSource: "auto" | "manual";
  currentStyle: TradeStyleValue | null;
}

export interface TradePatch {
  status: "open" | "closed";
  /** Earliest entry-in deal time — recomputed, so out-of-order heals it. */
  openedAt: Date | null;
  closedAt: Date | null;
  volumeOpened: string;
  volumeClosed: string;
  avgEntryPrice: string | null;
  avgExitPrice: string | null;
  sl: string | null;
  tp: string | null;
  initialSl: string | null;
  initialTp: string | null;
  grossProfit: string;
  commission: string;
  swap: string;
  fee: string;
  netProfit: string;
  riskAmount: string | null;
  rMultiple: string | null;
  pipsOrPoints: string | null;
  durationSeconds: number | null;
  /** Recomputed only for closed trades; null while open (db layer applies
   *  the strategy default or "day" for open trades, §9). */
  style: TradeStyleValue | null;
  closeReason: DealReasonValue | null;
}

const CLOSE_EPSILON = new Decimal("0.00000001");
const VOLUME_SCALE = 2;
const PRICE_SCALE = 5;
const MONEY_SCALE = 2;

function dec(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

const fmt = (d: Decimal, scale: number): string => d.toFixed(scale);

function isEntryDeal(entry: DealEntryValue): boolean {
  return entry === "in";
}

function isExitDeal(entry: DealEntryValue): boolean {
  return entry === "out" || entry === "inout" || entry === "out_by";
}

/**
 * `null`/`0` count as "not set" for SL/TP bookkeeping (§5.1: initial_* may be
 * filled "unless currently null/0").
 */
export function isPriceUnset(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true;
  const d = dec(value);
  return d.isZero();
}

/** Null/0 → incoming; otherwise never overwrite (initial SL/TP rule, §4.1). */
export function fillPriceOnce(current: string | null, incoming: string | null): string | null {
  if (!isPriceUnset(current)) return current;
  return incoming;
}

/** Composition of live SL/TP update + fill-if-unset for the initial values. */
function applyStops(input: TradePatchInput): Pick<TradePatch, "sl" | "tp" | "initialSl" | "initialTp"> {
  return {
    sl: input.incomingSl ?? input.currentSl,
    tp: input.incomingTp ?? input.currentTp,
    initialSl: fillPriceOnce(input.currentInitialSl, input.incomingSl),
    initialTp: fillPriceOnce(input.currentInitialTp, input.incomingTp),
  };
}

export function computeTradePatch(input: TradePatchInput): TradePatch {
  const { deals } = input;

  const ins = deals.filter((deal) => isEntryDeal(deal.entry));
  const outs = deals.filter((deal) => isExitDeal(deal.entry));
  const allTimes = deals.map((deal) => deal.timeUtc.getTime());

  // ---- Volume + weighted averages (§19: recompute from raw deals) ----------
  const volumeOpened = ins.reduce((sum, deal) => sum.plus(dec(deal.volume)), new Decimal(0));
  const volumeClosed = outs.reduce((sum, deal) => sum.plus(dec(deal.volume)), new Decimal(0));

  const avgEntryPrice =
    volumeOpened.isZero()
      ? null
      : ins.reduce(
          (sum, deal) => sum.plus(dec(deal.price).times(dec(deal.volume))),
          new Decimal(0),
        ).dividedBy(volumeOpened);

  const avgExitPrice =
    volumeClosed.isZero()
      ? null
      : outs.reduce(
          (sum, deal) => sum.plus(dec(deal.price).times(dec(deal.volume))),
          new Decimal(0),
        ).dividedBy(volumeClosed);

  const grossProfit = outs.reduce((sum, deal) => sum.plus(dec(deal.profit)), new Decimal(0));
  const commission = deals.reduce((sum, deal) => sum.plus(dec(deal.commission)), new Decimal(0));
  const swap = deals.reduce((sum, deal) => sum.plus(dec(deal.swap)), new Decimal(0));
  const fee = deals.reduce((sum, deal) => sum.plus(dec(deal.fee)), new Decimal(0));
  const netProfit = grossProfit.plus(commission).plus(swap).plus(fee);

  // ---- Times ---------------------------------------------------------------
  const entryTimes = ins.map((deal) => deal.timeUtc.getTime());
  const exitTimes = outs.map((deal) => deal.timeUtc.getTime());

  // Fall back to the earliest deal of any kind when only exits have arrived
  // (out-of-order close-before-open) — the later deal_open deal heals it.
  const openedAtMs = entryTimes.length > 0 ? Math.min(...entryTimes) : Math.min(...allTimes);
  const closedAtMs = exitTimes.length > 0 ? Math.max(...exitTimes) : null;

  const hasEntries = !volumeOpened.isZero();
  const remaining = volumeOpened.minus(volumeClosed);
  const isClosed = hasEntries && remaining.abs().lessThanOrEqualTo(CLOSE_EPSILON);

  const openedAt = allTimes.length > 0 ? new Date(openedAtMs) : null;
  const closedAt = isClosed && closedAtMs !== null ? new Date(closedAtMs) : null;

  const durationSeconds =
    openedAt !== null && closedAt !== null
      ? Math.max(0, Math.round((closedAt.getTime() - openedAt.getTime()) / 1000))
      : null;

  // ---- Style (§9) — re-classify on close unless the user took over ---------
  let style: TradeStyleValue | null = null;
  if (isClosed && openedAt !== null && closedAt !== null) {
    if (input.styleSource === "auto") {
      const duration = Math.max(0, Math.round((closedAt.getTime() - openedAt.getTime()) / 1000));
      style = classifyStyle({
        durationSeconds: duration,
        closedSameTradingDay: isSameTradingDay(openedAt, closedAt),
      });
    } else {
      style = input.currentStyle;
    }
  }

  // ---- Risk + R (§10): tick-value math only when the EA supplied it --------
  let riskAmount: Decimal | null = null;
  const initialSl = fillPriceOnce(input.currentInitialSl, input.incomingSl);
  if (avgEntryPrice !== null && initialSl !== null && input.tickValue && input.tickSize) {
    const slDistance = avgEntryPrice.minus(dec(initialSl)).abs();
    riskAmount = slDistance
      .dividedBy(new Decimal(input.tickSize))
      .times(new Decimal(input.tickValue))
      .times(volumeOpened);
    if (riskAmount.isZero()) riskAmount = null;
  }

  const rMultiple =
    riskAmount !== null && riskAmount.greaterThan(0)
      ? netProfit.dividedBy(riskAmount)
      : null;

  // ---- Signed move in price units (seed-plan convention, kept identical) ---
  const pipsOrPoints =
    avgEntryPrice !== null && avgExitPrice !== null
      ? (input.direction === "buy"
          ? avgExitPrice.minus(avgEntryPrice)
          : avgEntryPrice.minus(avgExitPrice)
        ).toFixed(PRICE_SCALE)
      : null;

  const lastOut = outs.length > 0 ? outs[outs.length - 1] : null;

  return {
    status: isClosed ? "closed" : "open",
    openedAt,
    closedAt,
    volumeOpened: fmt(volumeOpened, VOLUME_SCALE),
    volumeClosed: fmt(volumeClosed, VOLUME_SCALE),
    avgEntryPrice: avgEntryPrice !== null ? fmt(avgEntryPrice, PRICE_SCALE) : null,
    avgExitPrice: avgExitPrice !== null ? fmt(avgExitPrice, PRICE_SCALE) : null,
    ...applyStops(input),
    grossProfit: fmt(grossProfit, MONEY_SCALE),
    commission: fmt(commission, MONEY_SCALE),
    swap: fmt(swap, MONEY_SCALE),
    fee: fmt(fee, MONEY_SCALE),
    netProfit: fmt(netProfit, MONEY_SCALE),
    riskAmount: riskAmount !== null ? fmt(riskAmount, MONEY_SCALE) : null,
    rMultiple: rMultiple !== null ? fmt(rMultiple, 4) : null,
    pipsOrPoints,
    durationSeconds,
    style,
    closeReason: isClosed && lastOut !== null ? lastOut.reason : null,
  };
}

/** cash_op amount sign → cash_operations.type (deposits pollute PnL, §4.3). */
export function deriveCashOpType(profit: number | string): "deposit" | "withdrawal" {
  return dec(profit).isNegative() ? "withdrawal" : "deposit";
}
