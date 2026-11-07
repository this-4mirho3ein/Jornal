import { differenceInSeconds, formatDistanceToNowStrict } from "date-fns";

/**
 * Shared display helpers (spec §12.3). Money/prices are formatted only —
 * arithmetic always happens on numeric strings/decimal.js (spec §0 rule 7).
 */

/** `••••5678` style masking of MT5 logins (spec §8.1). */
export function maskLogin(login: number | string | null | undefined): string | null {
  if (login === null || login === undefined || login === "") return null;
  const s = String(login);
  const last4 = s.slice(-4);
  return `••••${last4}`;
}

interface MoneyFormatOptions {
  currency?: string;
  /** Prefix `+`/`−` explicitly (P&L display) instead of the default minus. */
  signed?: boolean;
  compact?: boolean;
}

export function formatMoney(
  value: string | number | null | undefined,
  opts: MoneyFormatOptions = {},
): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(amount)) return "—";
  try {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: opts.currency ?? "USD",
      notation: opts.compact ? "compact" : "standard",
      signDisplay: opts.signed ? "always" : "auto",
    }).format(amount);
    return formatted.replace("-", "−");
  } catch {
    // Non-ISO/app-code currencies (e.g. "BTC" on some brokers): plain number.
    const plain = new Intl.NumberFormat("en-US", {
      notation: opts.compact ? "compact" : "standard",
      signDisplay: opts.signed ? "always" : "auto",
    }).format(amount);
    return `${plain.replace("-", "−")} ${opts.currency ?? ""}`.trim();
  }
}

/** Absolute timestamp rendered in an account/user timezone (IANA name). */
export function formatDateTimeInTz(date: Date | string, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(d);
}

/** "5m ago" style label; `now` injectable for deterministic rendering. */
export function lastSeenLabel(
  lastSeen: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  if (!lastSeen) return "never";
  const seen = typeof lastSeen === "string" ? new Date(lastSeen) : lastSeen;
  if (Number.isNaN(seen.getTime())) return "never";
  if (differenceInSeconds(now, seen) < 45) return "just now";
  return `${formatDistanceToNowStrict(seen, { addSuffix: false })} ago`;
}

/** Compact "Nov 7, 09:58" wall-clock in a timezone — table columns and cards. */
export function formatDateTimeShortInTz(
  date: Date | string,
  timeZone: string,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(d);
}

/** Display-only R multiple: `1.8520` → `+1.85R`. Rounding only — no math. */
export function formatRMultiple(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}R`;
}

/** Duration in seconds → `1h 23m` / `4m 12s` (used by trades/analytics too). */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds))
    return "—";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
