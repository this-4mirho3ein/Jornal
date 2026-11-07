import { Decimal } from "decimal.js";

/**
 * §10 metrics that SQL cannot express cleanly — pure functions, string-safe
 * money (§0 rule 7): sums/averages via Decimal, ratios double-precision for
 * display only. Input rows come from the closed-trades queries.
 */

export interface TradeLite {
  netProfit: string | null;
  rMultiple: string | null;
}

export interface Kpis {
  wins: number;
  losses: number;
  breakeven: number;
  net: string;
  grossProfit: string;
  grossLoss: string; // negative number as string
  winRate: number | null; // percent of decided trades
  profitFactor: number | null;
  avgWin: string | null;
  avgLoss: string | null; // negative
  payoff: number | null;
  avgR: number | null;
  best: string | null;
  worst: string | null;
}

function dec(value: string | null | undefined): Decimal {
  return new Decimal(value ?? 0);
}

export function computeKpis(closed: TradeLite[]): Kpis {
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let grossWin = new Decimal(0);
  let grossLoss = new Decimal(0);
  let net = new Decimal(0);
  let rSum = new Decimal(0);
  let rCount = 0;
  let best: Decimal | null = null;
  let worst: Decimal | null = null;

  for (const trade of closed) {
    const value = dec(trade.netProfit);
    net = net.plus(value);
    if (value.gt(0)) {
      wins += 1;
      grossWin = grossWin.plus(value);
    } else if (value.lt(0)) {
      losses += 1;
      grossLoss = grossLoss.plus(value);
    } else {
      breakeven += 1;
    }
    if (best === null || value.gt(best)) best = value;
    if (worst === null || value.lt(worst)) worst = value;
    if (trade.rMultiple !== null && trade.rMultiple !== "") {
      const r = Number.parseFloat(trade.rMultiple);
      if (Number.isFinite(r)) {
        rSum = rSum.plus(r);
        rCount += 1;
      }
    }
  }

  const decided = wins + losses;
  const avgWin = wins > 0 ? grossWin.div(wins) : null;
  const avgLoss = losses > 0 ? grossLoss.div(losses) : null;
  const d = (value: Decimal | null): string | null => (value === null ? null : value.toFixed(2));

  return {
    wins,
    losses,
    breakeven,
    net: net.toFixed(2),
    grossProfit: grossWin.toFixed(2),
    grossLoss: grossLoss.toFixed(2),
    winRate:
      decided > 0 ? Number(new Decimal(wins).div(decided).mul(100).toFixed(1)) : null,
    profitFactor:
      losses > 0 && !grossLoss.isZero()
        ? Number(grossWin.div(grossLoss.neg()).toFixed(2))
        : null,
    avgWin: d(avgWin),
    avgLoss: d(avgLoss),
    payoff:
      avgWin && avgLoss && !avgLoss.isZero()
        ? Number(avgWin.div(avgLoss.neg()).toFixed(2))
        : null,
    avgR: rCount > 0 ? Number(rSum.div(rCount).toFixed(2)) : null,
    best: d(best),
    worst: d(worst),
  };
}

export interface EquityPoint {
  value: string | number;
}

export interface Drawdown {
  /** Peak-to-trough in the series' currency (string money). */
  absolute: string;
  /** Peak-to-trough relative to the peak, percent. */
  percent: number | null;
}

/** Classic max drawdown over an ordered equity series. */
export function maxDrawdown(points: EquityPoint[]): Drawdown {
  let peak = new Decimal(0);
  let maxAbs = new Decimal(0);
  let maxPct: number | null = null;

  for (const point of points) {
    const value = dec(
      typeof point.value === "number" ? String(point.value) : point.value,
    );
    if (value.gt(peak)) {
      peak = value;
    }
    const drop = peak.minus(value);
    if (drop.gt(maxAbs)) {
      maxAbs = drop;
      maxPct = peak.isZero() ? null : Number(drop.div(peak).mul(100).toFixed(2));
    }
  }

  return {
    absolute: maxAbs.toFixed(2),
    percent: maxAbs.isZero() ? (peak.isZero() ? null : 0) : maxPct,
  };
}

export interface Streaks {
  longestWin: number;
  longestLoss: number;
  /** Positive = current winning streak; negative = losing; 0 = none/BE. */
  current: number;
}

/**
 * Consecutive decided results in chronological order; breakeven passes
 * through without breaking either side but resets nothing.
 */
export function computeStreaks(closed: TradeLite[]): Streaks {
  let longestWin = 0;
  let longestLoss = 0;
  let runWin = 0;
  let runLoss = 0;
  let current = 0;

  for (const trade of closed) {
    const value = dec(trade.netProfit);
    if (value.gt(0)) {
      runWin += 1;
      runLoss = 0;
      longestWin = Math.max(longestWin, runWin);
      current = runWin;
    } else if (value.lt(0)) {
      runLoss += 1;
      runWin = 0;
      longestLoss = Math.max(longestLoss, runLoss);
      current = -runLoss;
    }
    // breakeven: neither side — current keeps its last decided state
  }
  if (longestWin === 0 && longestLoss === 0) current = 0;

  return { longestWin, longestLoss, current };
}

/** Expectancy in R (mean R across closed trades with known R). */
export function expectancyR(closed: TradeLite[]): number | null {
  let sum = new Decimal(0);
  let count = 0;
  for (const trade of closed) {
    if (trade.rMultiple === null || trade.rMultiple === "") continue;
    const r = Number.parseFloat(trade.rMultiple);
    if (Number.isFinite(r)) {
      sum = sum.plus(r);
      count += 1;
    }
  }
  return count > 0 ? Number(sum.div(count).toFixed(2)) : null;
}

export type DashboardPeriod = "7d" | "30d" | "90d" | "ytd" | "all";

export function parseDashboardPeriod(raw: unknown): DashboardPeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "7d" || value === "90d" || value === "ytd" || value === "all"
    ? value
    : "30d";
}

export function periodStartIso(period: DashboardPeriod, now: Date): string | null {
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 86_400_000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 86_400_000).toISOString();
    case "90d":
      return new Date(now.getTime() - 90 * 86_400_000).toISOString();
    case "ytd":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
    case "all":
      return null;
  }
}
