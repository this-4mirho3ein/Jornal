/**
 * Scalp/Day/Swing/Position auto-classification (spec §9).
 *
 * Pure function — thresholds are configurable from Settings (defaults below).
 * Interpretation of the spec's table, closed so there is no gap:
 *   scalp    < scalpMinutes (default 15 min)
 *   day      < 24 h AND closed within the same trading day (UTC day as fallback rule)
 *   swing    everything else from ≥ scalpMinutes up to twoWeeks (14 days) —
 *            includes short overnight holds
 *   position > twoWeeks (14 days)
 *
 * Trades that are still open have no duration → the caller applies the
 * strategy default (or "day") and re-classifies on close unless overridden.
 */

export interface StyleThresholds {
  /** Minutes; trades shorter than this are scalps. */
  scalpMinutes: number;
  /** Days; trades held longer than this are positions. */
  positionDays: number;
}

export const STYLE_THRESHOLDS: StyleThresholds = {
  scalpMinutes: 15,
  positionDays: 14,
};

export const TRADE_STYLE_VALUES = ["scalp", "day", "swing", "position"] as const;

export type TradeStyleValue = (typeof TRADE_STYLE_VALUES)[number];

export interface ClassifyStyleInput {
  durationSeconds: number;
  /** True when openedAt/closedAt fall on the same trading day. */
  closedSameTradingDay: boolean;
  thresholds?: StyleThresholds;
}

export function classifyStyle({
  durationSeconds,
  closedSameTradingDay,
  thresholds = STYLE_THRESHOLDS,
}: ClassifyStyleInput): TradeStyleValue | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return null;

  const scalpSec = thresholds.scalpMinutes * 60;
  const daySec = 24 * 60 * 60;
  const positionSec = thresholds.positionDays * 24 * 60 * 60;

  if (durationSeconds < scalpSec) return "scalp";
  if (durationSeconds < daySec && closedSameTradingDay) return "day";
  if (durationSeconds <= positionSec) return "swing";
  return "position";
}

/** Same-trading-day check in a fixed timezone offset (minutes). */
export function isSameTradingDay(
  openedAt: Date,
  closedAt: Date,
  timeZoneOffsetMinutes = 0,
): boolean {
  const shift = (d: Date) =>
    new Date(d.getTime() + timeZoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
  return shift(openedAt) === shift(closedAt);
}

/** "Auto" label policy (§9): auto values get an "Auto" tag in the UI. */
export const styleLabels: Record<TradeStyleValue, string> = {
  scalp: "Scalp",
  day: "Day",
  swing: "Swing",
  position: "Position",
};
