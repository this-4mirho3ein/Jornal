import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DirectionBadge } from "@/components/shared/direction-badge";
import { PnlText } from "@/components/shared/pnl-text";
import { StatusBadge } from "@/components/shared/status-badge";
import { StrategyBadge } from "@/components/shared/strategy-badge";
import type { TradeListRow } from "@/features/trades/queries";
import {
  formatDateTimeShortInTz,
  formatDuration,
  formatRMultiple,
} from "@/lib/format";
import Link from "next/link";
import { TradesRowLink } from "@/app/(app)/trades/row-link";

/**
 * Desktop table (spec §12.2) — plain server-rendered markup: sorting/filtering
 * live in the URL, so no client table library is needed (ADR 0006).
 */
export function TradeTable({
  rows,
  timezone,
}: {
  rows: TradeListRow[];
  timezone: string;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border md:block">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-center">Opened</TableHead>
            <TableHead className="text-center">Symbol</TableHead>
            <TableHead className="text-center">Side</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-right">Entry → Exit</TableHead>
            <TableHead className="text-right">Held</TableHead>
            <TableHead className="text-right">R</TableHead>
            <TableHead className="text-right">Net P/L</TableHead>
            <TableHead className="text-center">Strategy</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="hidden text-center xl:table-cell">Account</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TradesRowLink key={row.id} href={`/trades/${row.id}`}>
              <TableCell className="whitespace-nowrap text-center text-muted-foreground">
                {row.openedAt
                  ? formatDateTimeShortInTz(row.openedAt, timezone)
                  : "—"}
              </TableCell>
              <TableCell className="text-center font-medium">
                {/* Sheet interception + deep link (§8.2) */}
                <Link
                  href={`/trades/${row.id}`}
                  scroll={false}
                  className="underline-offset-4 hover:underline"
                >
                  {row.symbol}
                </Link>
              </TableCell>
              <TableCell className="text-center">
                <DirectionBadge direction={row.direction} />
              </TableCell>
              <TableCell className="text-center font-mono tabular-nums">
                {row.volumeOpened ?? "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-center font-mono tabular-nums">
                {row.avgEntryPrice ?? "—"}
                <span className="mx-1 text-muted-foreground">→</span>
                {row.closedAt ? (row.avgExitPrice ?? "—") : "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-center text-muted-foreground">
                {formatDuration(row.durationSeconds)}
              </TableCell>
              <TableCell className="text-center font-mono tabular-nums">
                {formatRMultiple(row.rMultiple)}
              </TableCell>
              <TableCell className="text-center">
                <PnlText value={row.netProfit} />
              </TableCell>
              <TableCell className="text-center">
                {row.strategyName ? (
                  <StrategyBadge name={row.strategyName} color={row.strategyColor} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground xl:table-cell">
                {row.accountName}
              </TableCell>
            </TradesRowLink>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
