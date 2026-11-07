import type { TradeListRow } from "@/features/trades/queries";

/**
 * CSV export of the filtered trades set (spec §11). Numbers are emitted as
 * the raw numeric strings from Postgres — no float formatting happens here.
 */

const CSV_HEADER = [
  "position_id",
  "account",
  "symbol",
  "direction",
  "status",
  "opened_utc",
  "closed_utc",
  "duration_seconds",
  "volume_opened",
  "volume_closed",
  "entry",
  "exit",
  "gross_profit",
  "commission",
  "swap",
  "fee",
  "net_profit",
  "r_multiple",
  "strategy",
  "style",
  "style_source",
  "magic",
  "mt5_comment",
  "notes",
  "rating",
] as const;

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function isoUtc(value: Date | string | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function tradesToCsv(rows: TradeListRow[]): string {
  const lines = rows.map((r) =>
    [
      String(r.positionId),
      r.accountName,
      r.symbol,
      r.direction,
      r.status,
      isoUtc(r.openedAt),
      isoUtc(r.closedAt),
      r.durationSeconds ?? "",
      r.volumeOpened ?? "",
      r.volumeClosed ?? "",
      r.avgEntryPrice ?? "",
      r.avgExitPrice ?? "",
      r.grossProfit ?? "",
      r.commission ?? "",
      r.swap ?? "",
      r.fee ?? "",
      r.netProfit ?? "",
      r.rMultiple ?? "",
      r.strategyName ?? "",
      r.style ?? "",
      r.styleSource,
      r.mt5Magic ?? "",
      r.mt5Comment ?? "",
      r.notes ?? "",
      r.rating ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_HEADER.join(","), ...lines].join("\r\n") + "\r\n";
}
