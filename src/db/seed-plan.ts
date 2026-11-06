import type { Direction, TradeStyle } from "./schema";
import { classifyStyle, isSameTradingDay } from "@/lib/trade-style";

/**
 * Pure seed planning logic (used by src/db/seed.ts).
 * Deterministic via an injected RNG so runs are reproducible.
 * NOTE: aggregation mirrors the future ingest reducer; task 05 shares it.
 */

export const COMMISSION_PER_LOT = -3.5;

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SymbolMeta {
  base: number;
  digits: number;
  tickSize: number;
  tickValue: number;
  volume: [number, number];
  /** [min, max, digits] for the initial SL distance. */
  slRange: [number, number, number];
  entryJitter: number;
}

export const SYMBOLS: Record<string, SymbolMeta> = {
  XAUUSD: {
    base: 2350, digits: 2, tickSize: 0.01, tickValue: 1,
    volume: [0.1, 0.5], slRange: [2, 8, 2], entryJitter: 4,
  },
  EURUSD: {
    base: 1.085, digits: 5, tickSize: 0.00001, tickValue: 1,
    volume: [0.2, 1.0], slRange: [0.0008, 0.004, 5], entryJitter: 0.003,
  },
  GBPUSD: {
    base: 1.272, digits: 5, tickSize: 0.00001, tickValue: 1,
    volume: [0.1, 0.8], slRange: [0.0008, 0.004, 5], entryJitter: 0.003,
  },
  NAS100: {
    base: 18500, digits: 1, tickSize: 0.1, tickValue: 1,
    volume: [0.5, 2.0], slRange: [15, 80, 1], entryJitter: 60,
  },
  BTCUSD: {
    base: 68000, digits: 2, tickSize: 0.01, tickValue: 0.01,
    volume: [0.05, 0.3], slRange: [250, 1200, 0], entryJitter: 500,
  },
};

export const MAGIC_TO_STRATEGY = { 1001: "ICT-SB", 1002: "ICT-OB", 1003: "LB", 1004: "MR" } as const;

export interface DealPlan {
  dealId: number;
  orderId: number;
  entry: "in" | "out";
  price: string;
  volume: string;
  profit: string;
  commission: string;
  swap: string;
  timeUtc: Date;
  reason: "client" | "sl" | "tp";
}

export interface TradePlan {
  accountId: string;
  positionId: number;
  symbolKey: string;
  direction: Direction;
  magic: number;
  strategyCode: (typeof MAGIC_TO_STRATEGY)[keyof typeof MAGIC_TO_STRATEGY];
  comment: string;
  openedAt: Date;
  closedAt: Date | null;
  initialSl: number;
  initialTp: number;
  deals: DealPlan[];
}

interface Rng {
  (): number;
}

export interface PlanContext {
  rand: Rng;
  nowMs: number;
}

/** between(min,max) using the context RNG with fixed digits. */
export function between(ctx: PlanContext, min: number, max: number, digits = 2): number {
  return Number((min + ctx.rand() * (max - min)).toFixed(digits));
}

export function pick<T>(ctx: PlanContext, arr: readonly T[]): T {
  return arr[Math.floor(ctx.rand() * arr.length)];
}

function dealPlanOut(
  dealId: number,
  orderId: number,
  price: number,
  volume: number,
  profit: number,
  swap: number,
  timeUtc: Date,
  digits: number,
  rand: Rng,
): DealPlan {
  const roll = rand();
  const reason: DealPlan["reason"] = roll < 0.3 ? "sl" : roll < 0.6 ? "tp" : "client";
  return {
    dealId,
    orderId,
    entry: "out",
    price: price.toFixed(digits),
    volume: volume.toFixed(2),
    profit: profit.toFixed(2),
    commission: (COMMISSION_PER_LOT * volume).toFixed(2),
    swap: swap.toFixed(2),
    timeUtc,
    reason,
  };
}

export function buildTrade(
  ctx: PlanContext,
  accountId: string,
  positionId: number,
  requestedOpen: Date,
): TradePlan {
  const { rand, nowMs } = ctx;
  const symbolKeys = Object.keys(SYMBOLS);
  const symbolKey = symbolKeys[Math.floor(rand() * symbolKeys.length)];
  const sym: SymbolMeta = SYMBOLS[symbolKey];
  const direction: Direction = rand() < 0.5 ? "buy" : "sell";
  const magicRow = pick(ctx, [1001, 1002, 1003, 1004] as const);
  const magic: keyof typeof MAGIC_TO_STRATEGY = magicRow;
  const strategyCode = MAGIC_TO_STRATEGY[magic];

  // Holding time by style: ~35% scalp, 45% day, 17% swing, 3% position
  const styleRoll = rand();
  let minutes: number;
  if (styleRoll < 0.35) {
    minutes = between(ctx, 2, 14, 1);
  } else if (styleRoll < 0.8) {
    minutes = between(ctx, 20, 8 * 60, 0);
  } else if (styleRoll < 0.97) {
    minutes = between(ctx, 26 * 60, 8 * 24 * 60, 0);
  } else {
    minutes = between(ctx, 16 * 24 * 60, 24 * 24 * 60, 0);
  }

  const opened = new Date(Math.min(requestedOpen.getTime(), nowMs - 2 * 3_600_000));
  let closedAt: Date | null = new Date(opened.getTime() + minutes * 60_000);
  if (rand() < 0.07 || closedAt.getTime() > nowMs) closedAt = null;
  const actuallyClosed = closedAt !== null;

  const volume = between(ctx, sym.volume[0], sym.volume[1]);
  const entry = sym.base + between(ctx, -sym.entryJitter, sym.entryJitter, sym.digits);
  const slDistance = between(ctx, sym.slRange[0], sym.slRange[1], sym.slRange[2]);
  const dirSign = direction === "buy" ? 1 : -1;
  const initialSl = entry - dirSign * slDistance;
  const initialTp = entry + dirSign * slDistance * between(ctx, 1.2, 3.2, 2);

  const outcome = rand() < 0.55 ? "win" : rand() < 0.7 ? "loss" : "be";
  const rFactor =
    outcome === "win"
      ? between(ctx, 0.8, 2.8, 2)
      : outcome === "loss"
        ? -between(ctx, 0.4, 1.05, 2)
        : 0;
  const exitDistance = slDistance * rFactor;
  const exit = actuallyClosed ? entry + dirSign * exitDistance : null;

  const deals: DealPlan[] = [];
  const baseDealId = positionId * 91;
  const baseOrderId = positionId * 91 + 500000000;
  let dealNo = 0;

  deals.push({
    dealId: baseDealId + dealNo,
    orderId: baseOrderId + dealNo,
    entry: "in",
    price: entry.toFixed(sym.digits),
    volume: volume.toFixed(2),
    profit: "0.00",
    commission: (COMMISSION_PER_LOT * volume).toFixed(2),
    swap: "0.00",
    timeUtc: new Date(opened),
    reason: "client",
  });
  dealNo += 1;

  if (actuallyClosed && exit !== null && closedAt !== null) {
    const moneyPerUnit = sym.tickValue / sym.tickSize;
    const gross = (exit - entry) * moneyPerUnit * volume * dirSign;
    const swapTotal = minutes > 24 * 60 ? -between(ctx, 1, 6) : 0;

    const hasPartial = rand() < 0.25 && volume >= 0.2;
    if (hasPartial) {
      const partialVolume = Number((volume / 2).toFixed(2));
      const finalVolume = Number((volume - partialVolume).toFixed(2));
      const partialExit = entry + dirSign * (exitDistance / 2);
      const partialGross = (partialExit - entry) * moneyPerUnit * partialVolume * dirSign;

      deals.push({
        dealId: baseDealId + dealNo,
        orderId: baseOrderId + dealNo,
        entry: "out",
        price: partialExit.toFixed(sym.digits),
        volume: partialVolume.toFixed(2),
        profit: partialGross.toFixed(2),
        commission: (COMMISSION_PER_LOT * partialVolume).toFixed(2),
        swap: "0.00",
        timeUtc: new Date(closedAt.getTime() - (minutes * 60_000) / 2),
        reason: "client",
      });
      dealNo += 1;
      deals.push(
        dealPlanOut(
          baseDealId + dealNo,
          baseOrderId + dealNo,
          exit,
          finalVolume,
          gross - partialGross,
          swapTotal,
          closedAt,
          sym.digits,
          rand,
        ),
      );
      dealNo += 1;
    } else {
      deals.push(
        dealPlanOut(
          baseDealId + dealNo,
          baseOrderId + dealNo,
          exit,
          volume,
          gross,
          swapTotal,
          closedAt,
          sym.digits,
          rand,
        ),
      );
      dealNo += 1;
    }
  }

  return {
    accountId,
    positionId,
    symbolKey,
    direction,
    magic,
    strategyCode,
    comment: `S:${strategyCode}`,
    openedAt: opened,
    closedAt,
    initialSl,
    initialTp,
    deals,
  };
}

export interface TradeAggregates {
  volumeOpened: string;
  volumeClosed: string;
  avgEntryPrice: string;
  avgExitPrice: string | null;
  initialSl: string;
  initialTp: string;
  grossProfit: string;
  commission: string;
  swap: string;
  fee: string;
  netProfit: string;
  riskAmount: string | null;
  rMultiple: string | null;
  pipsOrPoints: string | null;
  durationSeconds: number | null;
  style: TradeStyle | null;
}

/** Aggregate a trade plan from its deals — mirrors the ingest recomputation. */
export function aggregateTrade(plan: TradePlan): TradeAggregates {
  const sym: SymbolMeta = SYMBOLS[plan.symbolKey];
  const ins = plan.deals.filter((d) => d.entry === "in");
  const outs = plan.deals.filter((d) => d.entry === "out");

  const volumeOpened = ins.reduce((s, d) => s + Number(d.volume), 0);
  const volumeClosed = outs.reduce((s, d) => s + Number(d.volume), 0);
  const avgEntry =
    ins.reduce((s, d) => s + Number(d.price) * Number(d.volume), 0) / (volumeOpened || 1);
  const avgExit =
    volumeClosed > 0
      ? outs.reduce((s, d) => s + Number(d.price) * Number(d.volume), 0) / volumeClosed
      : null;

  const grossProfit = outs.reduce((s, d) => s + Number(d.profit), 0);
  const commission = plan.deals.reduce((s, d) => s + Number(d.commission), 0);
  const swap = plan.deals.reduce((s, d) => s + Number(d.swap), 0);
  const fee = 0;
  const netProfit = grossProfit + commission + swap + fee;

  const durationSeconds = plan.closedAt
    ? Math.round((plan.closedAt.getTime() - plan.openedAt.getTime()) / 1000)
    : null;

  const style: TradeStyle | null =
    durationSeconds === null || plan.closedAt === null
      ? null
      : classifyStyle({
          durationSeconds,
          closedSameTradingDay: isSameTradingDay(plan.openedAt, plan.closedAt),
        });

  const slDistance = Math.abs(avgEntry - plan.initialSl);
  const riskAmount = plan.initialSl
    ? Number(((slDistance / sym.tickSize) * sym.tickValue * volumeOpened).toFixed(2))
    : null;
  const rMultiple =
    riskAmount !== null && riskAmount > 0 ? Number((netProfit / riskAmount).toFixed(4)) : null;
  const pipsOrPoints =
    avgExit !== null
      ? (plan.direction === "buy" ? avgExit - avgEntry : avgEntry - avgExit).toFixed(5)
      : null;

  const fmt = (n: number): string => n.toFixed(sym.digits > 2 ? 5 : sym.digits);
  return {
    volumeOpened: volumeOpened.toFixed(2),
    volumeClosed: volumeClosed.toFixed(2),
    avgEntryPrice: fmt(avgEntry),
    avgExitPrice: avgExit !== null ? fmt(avgExit) : null,
    initialSl: fmt(plan.initialSl),
    initialTp: fmt(plan.initialTp),
    grossProfit: grossProfit.toFixed(2),
    commission: commission.toFixed(2),
    swap: swap.toFixed(2),
    fee: fee.toFixed(2),
    netProfit: netProfit.toFixed(2),
    riskAmount: riskAmount !== null ? riskAmount.toFixed(2) : null,
    rMultiple: rMultiple !== null ? rMultiple.toFixed(4) : null,
    pipsOrPoints,
    durationSeconds,
    style,
  };
}
