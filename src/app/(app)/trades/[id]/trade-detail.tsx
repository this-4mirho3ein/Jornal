import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { JournalForm } from "@/app/(app)/trades/[id]/journal-form";
import { ScreenshotGallery } from "@/app/(app)/trades/[id]/screenshot-gallery";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StyleBadge } from "@/components/shared/style-badge";
import { getTradeImages } from "@/features/journal-images/queries";
import { getTradeDetail } from "@/features/trades/detail-queries";
import {
  formatDateTimeInTz,
  formatDateTimeShortInTz,
  formatDuration,
  formatMoney,
  formatRMultiple,
} from "@/lib/format";
import { getCurrentUser } from "@/lib/auth/guards";
import { imageDriver } from "@/lib/storage/storage";

function KeyNumber({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}

/** Full §8.2 detail: header, key numbers, gallery, journal, timeline. */
export async function TradeDetailSections({ tradeId }: { tradeId: string }) {
  const user = await getCurrentUser();
  const detail = await getTradeDetail(user.id, tradeId);
  if (!detail) notFound();
  const images = await getTradeImages(user.id, tradeId);

  const trade = detail.trade;
  const timezone = detail.account.timezone;
  const currency = detail.account.currency;
  const money = (value: string | null): string => formatMoney(value, { currency });

  const entry = trade.avgEntryPrice ? Number(trade.avgEntryPrice) : null;
  const initialSl = trade.initialSl ? Number(trade.initialSl) : null;
  const initialTp = trade.initialTp ? Number(trade.initialTp) : null;
  const riskPerUnit =
    entry !== null && initialSl !== null ? Math.abs(entry - initialSl) : null;
  const plannedRR =
    riskPerUnit && initialTp !== null && initialTp > 0 && riskPerUnit > 0
      ? Math.abs(initialTp - entry!) / riskPerUnit
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* §8.2 #1 — header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {trade.symbol}
          <DirectionBadge direction={trade.direction} />
        </h2>
        <StatusBadge status={trade.status} />
        <StyleBadge
          style={trade.style ?? "day"}
          source={trade.styleSource}
        />
        <span className="text-xs text-muted-foreground">
          {detail.account.displayName}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <PnlText value={trade.netProfit} />
          <span className="font-mono text-sm tabular-nums">
            {formatRMultiple(trade.rMultiple)}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Opened {trade.openedAt ? formatDateTimeInTz(trade.openedAt, timezone) : "—"}
        {trade.closedAt
          ? ` · Closed ${formatDateTimeInTz(trade.closedAt, timezone)}`
          : ""}
        {" · Magic "}
        {trade.mt5Magic ?? "—"}
        {trade.mt5Comment ? ` · ${trade.mt5Comment}` : ""}
      </p>

      {/* §8.2 #2 — key numbers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Key numbers</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          <KeyNumber label="Entry" value={trade.avgEntryPrice ?? "—"} />
          <KeyNumber
            label="Exit"
            value={trade.status === "closed" ? (trade.avgExitPrice ?? "—") : "—"}
          />
          <KeyNumber label="Initial SL" value={trade.initialSl ?? "—"} />
          <KeyNumber label="Initial TP" value={trade.initialTp ?? "—"} />
          <KeyNumber label="SL (current)" value={trade.sl ?? "—"} />
          <KeyNumber label="TP (current)" value={trade.tp ?? "—"} />
          <KeyNumber
            label="Volume"
            value={
              trade.volumeOpened
                ? `${trade.volumeOpened}${
                    trade.volumeClosed && trade.volumeClosed !== trade.volumeOpened
                      ? ` → ${trade.volumeClosed}`
                      : ""
                  }`
                : "—"
            }
          />
          <KeyNumber label="Risk amount" value={money(trade.riskAmount)} />
          <KeyNumber
            label="RR planned"
            value={plannedRR ? `1 : ${plannedRR.toFixed(2)}` : "—"}
          />
          <KeyNumber label="R achieved" value={formatRMultiple(trade.rMultiple)} />
          <KeyNumber label="Duration" value={formatDuration(trade.durationSeconds)} />
          <KeyNumber label="Commission" value={money(trade.commission)} />
          <KeyNumber label="Swap" value={money(trade.swap)} />
          <KeyNumber label="Fees" value={money(trade.fee)} />
          <KeyNumber label="Balance before" value={money(trade.balanceAtOpen)} />
          <KeyNumber label="Balance after" value={money(trade.balanceAtClose)} />
        </CardContent>
      </Card>

      {/* §8.2 #3 — screenshots */}
      <ScreenshotGallery
        tradeId={tradeId}
        initialImages={images}
        driver={imageDriver()}
      />

      {/* §8.2 #4/#6 — journal + autosave */}
      <JournalForm
        tradeId={tradeId}
        strategyOptions={detail.strategyOptions}
        initial={{
          strategyId: trade.strategyId,
          style: trade.style,
          styleSource: trade.styleSource,
          rating: trade.rating,
          emotion: trade.emotion,
          notes: trade.notes,
          setupTags: trade.setupTags,
          mistakeTags: trade.mistakeTags,
        }}
      />

      {/* §8.2 #5 — timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Deals & SL/TP history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Time</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.deals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTimeShortInTz(deal.timeUtc, timezone)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{deal.entry}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {deal.price ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {deal.volume ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <PnlText value={deal.profit} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {deal.reason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {detail.modifies.length > 0 ? (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {detail.modifies.map((modify) => (
                <li key={modify.eventId}>
                  <span className="font-mono tabular-nums">
                    {formatDateTimeShortInTz(modify.receivedAt, timezone)}
                  </span>{" "}
                  — SL → {modify.sl ?? "none"} · TP → {modify.tp ?? "none"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No SL/TP modifications recorded for this position.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
