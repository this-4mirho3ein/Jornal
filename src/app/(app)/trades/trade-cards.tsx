import { DirectionBadge } from "@/components/shared/direction-badge";
import { PnlText } from "@/components/shared/pnl-text";
import { StatusBadge } from "@/components/shared/status-badge";
import { StrategyBadge } from "@/components/shared/strategy-badge";
import { StyleBadge } from "@/components/shared/style-badge";
import type { TradeListRow } from "@/features/trades/queries";
import { formatDateTimeShortInTz, formatDuration } from "@/lib/format";

/**
 * Mobile trade cards (spec §12.2) — same rows as the desktop table, switched
 * via `md:hidden`; the table renders `hidden md:block`.
 */
export function TradeCards({
  rows,
  timezone,
}: {
  rows: TradeListRow[];
  timezone: string;
}) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              {row.symbol}
              <DirectionBadge direction={row.direction} />
            </span>
            <PnlText value={row.netProfit} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {row.openedAt
                ? formatDateTimeShortInTz(row.openedAt, timezone)
                : "—"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatDuration(row.durationSeconds)}</span>
            {row.volumeOpened ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {row.volumeOpened}
                  {row.avgEntryPrice ? ` @ ${row.avgEntryPrice}` : ""}
                </span>
              </>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.strategyName ? (
              <StrategyBadge name={row.strategyName} color={row.strategyColor} />
            ) : null}
            {row.style ? (
              <StyleBadge style={row.style} source={row.styleSource} />
            ) : null}
            <StatusBadge status={row.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
