/**
 * Forex trading sessions (§12 trade metadata) — canonical UTC windows:
 *   Sydney 21:00–06:00, Tokyo 00:00–09:00, London 08:00–17:00,
 *   New York 13:00–22:00 (each half-open, ends excluded).
 * Overlaps are meaningful (e.g. London × New York 13:00–17:00) and are
 * reported together in display order.
 */

export interface TradingSession {
  key: "sydney" | "tokyo" | "london" | "newyork";
  label: string;
  /** UTC hour the session opens. */
  startHourUtc: number;
  /** UTC hour the session closes (exclusive; may be < start → wraps midnight). */
  endHourUtc: number;
}

export const TRADING_SESSIONS: readonly TradingSession[] = [
  { key: "sydney", label: "Sydney", startHourUtc: 21, endHourUtc: 6 },
  { key: "tokyo", label: "Tokyo", startHourUtc: 0, endHourUtc: 9 },
  { key: "london", label: "London", startHourUtc: 8, endHourUtc: 17 },
  { key: "newyork", label: "New York", startHourUtc: 13, endHourUtc: 22 },
];

function covers(session: TradingSession, hourUtc: number): boolean {
  return session.startHourUtc <= session.endHourUtc
    ? hourUtc >= session.startHourUtc && hourUtc < session.endHourUtc
    : hourUtc >= session.startHourUtc || hourUtc < session.endHourUtc;
}

/** Every session window the given instant falls into (UTC clock). */
export function sessionsForTime(date: Date): TradingSession[] {
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  return TRADING_SESSIONS.filter((session) => covers(session, hour));
}

/** "London + New York" style label; "—" only if sessions regress to empty. */
export function sessionLabelFor(date: Date): string {
  return (
    sessionsForTime(date)
      .map((session) => session.label)
      .join(" + ") || "—"
  );
}
