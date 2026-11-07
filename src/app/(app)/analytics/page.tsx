import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import {
  BreakdownBarsLazy,
  RDistributionLazy,
} from "@/components/charts/charts-lazy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StyleBadge } from "@/components/shared/style-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getBreakdowns,
  getRDistribution,
  getStyleCompare,
} from "@/features/analytics/queries";
import {
  parseDashboardPeriod,
  resolveDashboardScope,
} from "@/features/dashboard/queries";
import type { BreakdownRow } from "@/features/analytics/queries";
import { periodStartIso } from "@/lib/metrics";
import { formatDuration, formatMoney } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth/guards";
import { hourLabel, PeriodChips, weekdayLabel } from "@/components/shared/period-chips";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage(props: PageProps<"/analytics">) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="text-lg font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Breakdowns by strategy, symbol, style, weekday and session hour — closed trades only.
        </p>
      </div>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function RowTable({
  rows,
  currency,
}: {
  rows: BreakdownRow[];
  currency: string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Label</TableHead>
            <TableHead className="text-right">Trades</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead className="text-right">Avg R</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="text-xs">{row.label}</TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {row.n}
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {formatMoney(row.net, { currency, signed: true })}
              </TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {row.avgR ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: BreakdownRow[];
  currency: string;
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <BreakdownBarsLazy
          data={rows.map((row) => ({ label: row.label, net: row.net }))}
          currency={currency}
        />
        <RowTable rows={rows} currency={currency} />
      </CardContent>
    </Card>
  );
}

async function AnalyticsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const scope = await resolveDashboardScope(user.id, params);
  const period = parseDashboardPeriod(params.period);
  const startIso = periodStartIso(period, new Date()); // request-time clock

  const [breakdowns, styleCompare, rDist] = await Promise.all([
    getBreakdowns(scope.userId, scope.accountId, startIso, scope.timezone),
    getStyleCompare(scope.userId, scope.accountId, startIso),
    getRDistribution(scope.userId, scope.accountId, startIso),
  ]);

  const total = breakdowns.bySymbol.reduce((sum, row) => sum + row.n, 0);
  const money = (value: string): string => formatMoney(value, { currency: scope.currency });
  const weekdayRows = breakdowns.byWeekday.map((row) => ({
    ...row,
    label: weekdayLabel(row.label),
  }));
  const hourRows = breakdowns.byHour.map((row) => ({
    ...row,
    label: hourLabel(row.label),
  }));

  if (total === 0) {
    return (
      <>
        <PeriodChips current={period} searchParams={params} />
        <EmptyState
          icon={BarChart3}
          title="No closed trades in this period"
          description="Analytics fill in automatically as closes land — widen the period or connect the EA."
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {total} closed trade{total === 1 ? "" : "s"}
          {scope.accountId ? "" : " · all accounts"}
        </p>
        <PeriodChips current={period} searchParams={params} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {breakdowns.byStrategy.length > 0 ? (
          <BreakdownCard
            title="By strategy"
            rows={breakdowns.byStrategy}
            currency={scope.currency}
          />
        ) : null}
        {breakdowns.bySymbol.length > 0 ? (
          <BreakdownCard
            title="By symbol"
            rows={breakdowns.bySymbol}
            currency={scope.currency}
          />
        ) : null}
        {breakdowns.byStyle.length > 0 ? (
          <BreakdownCard
            title="By style (§9)"
            rows={breakdowns.byStyle}
            currency={scope.currency}
          />
        ) : null}
        {weekdayRows.length > 0 ? (
          <BreakdownCard title="By weekday" rows={weekdayRows} currency={scope.currency} />
        ) : null}
        {hourRows.length > 0 ? (
          <BreakdownCard title="By session hour" rows={hourRows} currency={scope.currency} />
        ) : null}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">R-multiple distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <RDistributionLazy data={rDist} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Scalp vs swing vs day vs position (§9)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Style</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win rate</TableHead>
                <TableHead className="text-right">Expectancy (avg R)</TableHead>
                <TableHead className="text-right">Profit factor</TableHead>
                <TableHead className="text-right">Avg duration</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {styleCompare.map((row) =>
                row.style === "unclassified" ? (
                  <TableRow key={row.style}>
                    <TableCell className="text-xs text-muted-foreground">
                      Unclassified
                    </TableCell>
                    <StyleCompareCells row={row} money={money} />
                  </TableRow>
                ) : (
                  <TableRow key={row.style}>
                    <TableCell>
                      <StyleBadge style={row.style as "scalp"} source="auto" />
                    </TableCell>
                    <StyleCompareCells row={row} money={money} />
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function StyleCompareCells({
  row,
  money,
}: {
  row: Awaited<ReturnType<typeof getStyleCompare>>[number];
  money: (value: string) => string;
}) {
  return (
    <>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {row.n}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {row.winRate === null ? "—" : `${row.winRate}%`}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {row.avgR === null ? "—" : `${Number(row.avgR) >= 0 ? "+" : ""}${row.avgR}R`}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {row.profitFactor ?? "—"}
      </TableCell>
      <TableCell className="text-right text-xs">
        {row.avgDurationSeconds === null
          ? "—"
          : formatDuration(row.avgDurationSeconds)}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {money(row.net)}
      </TableCell>
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-56 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
