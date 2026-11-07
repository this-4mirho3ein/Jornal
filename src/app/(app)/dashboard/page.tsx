import {
  Activity,
  Percent,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { EquityCurveLazy } from "@/components/charts/charts-lazy";
import { PnlHeatmap } from "@/components/charts/pnl-heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { PeriodChips } from "@/components/shared/period-chips";
import { PnlText } from "@/components/shared/pnl-text";
import {
  getClosedTradeLites,
  getDailyPnl,
  getDashboardKpis,
  getEquitySeries,
  getRecentTrades,
  parseDashboardPeriod,
  resolveDashboardScope,
} from "@/features/dashboard/queries";
import { computeStreaks, expectancyR, maxDrawdown, periodStartIso } from "@/lib/metrics";
import { formatDateTimeShortInTz, formatMoney } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Performance, equity and the last 30 days — scoped to your account switcher.
        </p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Request-time clock — connection() goes FIRST so the render opts out of
  // the prerender scope before any other awaited work (blocking-prerender).
  await connection();
  const params = await searchParams;
  const user = await getCurrentUser();
  const scope = await resolveDashboardScope(user.id, params);
  const period = parseDashboardPeriod(params.period);
  const now = new Date(); // request time (streamed subtree)
  const startIso = periodStartIso(period, now);

  const [kpis, lites, equity, daily, recent] = await Promise.all([
    getDashboardKpis(scope.userId, scope.accountId, startIso),
    getClosedTradeLites(scope.userId, scope.accountId, startIso),
    getEquitySeries(scope.userId, scope.accountId, startIso),
    getDailyPnl(scope.userId, scope.accountId, startIso, scope.timezone),
    getRecentTrades(scope.userId, scope.accountId, 5),
  ]);

  const closedLites = lites.map((l) => ({ netProfit: l.netProfit, rMultiple: l.rMultiple }));
  const streaks = computeStreaks(closedLites);
  const expR = expectancyR(closedLites);
  const drawdown = maxDrawdown(equity.map((point) => ({ value: point.value })));
  const decided = kpis.wins + kpis.losses;
  const winRate = decided > 0 ? Math.round((kpis.wins / decided) * 1000) / 10 : null;
  const grossLoss = Number(kpis.grossLoss);
  const profitFactor =
    decided > 0 && grossLoss !== 0
      ? Math.round((Number(kpis.grossWin) / Math.abs(grossLoss)) * 100) / 100
      : null;
  const net = Number(kpis.net);
  const money = (value: string | null): string => formatMoney(value, { currency: scope.currency });

  // 30 calendar-day keys in the ACCOUNT timezone (server-rendered)
  const byDay = new Map(daily.map((row) => [row.day, row]));
  const days: Array<{ day: string; pnl: string; n: number }> = Array.from(
    { length: 30 },
    (_, index) => {
      const date = new Date(now.getTime() - (29 - index) * 86_400_000);
      const key = new Intl.DateTimeFormat("en-CA", { timeZone: scope.timezone }).format(date);
      const row = byDay.get(key);
      return { day: key, pnl: row?.pnl ?? "0", n: row?.n ?? 0 };
    },
  );

  if (kpis.closed === 0 && kpis.open === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Nothing to show yet"
        description="Attach the EA to one MT5 chart — trades, equity and every metric fill in automatically."
        action={
          <Button asChild size="sm">
            <Link href="/accounts">Set up the EA in Accounts</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {kpis.closed} closed · {kpis.open} open
          {scope.accountId ? "" : " · all accounts"}
        </p>
        <PeriodChips current={period} searchParams={params} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Net P/L"
          value={money(kpis.net)}
          icon={net >= 0 ? TrendingUp : TrendingDown}
          tone={net > 0 ? "positive" : net < 0 ? "negative" : "muted"}
          sub={`${kpis.wins}W · ${kpis.losses}L · ${kpis.breakeven}BE`}
        />
        <StatCard
          label="Win rate"
          value={winRate === null ? "—" : `${winRate}%`}
          icon={Percent}
          tone="info"
          sub={`${kpis.breakeven} breakeven`}
        />
        <StatCard
          label="Profit factor"
          value={profitFactor === null ? "—" : profitFactor.toFixed(2)}
          icon={Scale}
          tone={profitFactor !== null && profitFactor >= 1 ? "positive" : profitFactor === null ? "muted" : "negative"}
          sub={`gross ${money(kpis.grossWin)} / ${money(kpis.grossLoss)}`}
        />
        <StatCard
          label="Avg R (expectancy)"
          value={expR === null ? "—" : `${expR >= 0 ? "+" : ""}${expR}R`}
          icon={Target}
          tone={expR !== null && expR >= 0 ? "positive" : expR === null ? "muted" : "negative"}
          sub={`max DD ${money(drawdown.absolute)}${drawdown.percent !== null ? ` (${drawdown.percent}%)` : ""}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Equity curve</CardTitle>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <TrendingUp className="size-3.5 text-emerald-500" aria-hidden="true" />
                best streak {streaks.longestWin}
              </span>
              <span className="flex items-center gap-1">
                <TrendingDown className="size-3.5 text-red-500" aria-hidden="true" />
                worst {streaks.longestLoss}
              </span>
            </span>
          </CardHeader>
          <CardContent>
            {equity.length < 2 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Heartbeats build this curve — points appear every ~30 s while the EA runs.
              </p>
            ) : (
              <EquityCurveLazy points={equity} currency={scope.currency} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">P/L calendar (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <PnlHeatmap days={days} currency={scope.currency} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Recent trades</CardTitle>
          {recent[0] ? (
            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
              <Link href={`/trades/${recent[0].id}`}>
                Add screenshot to latest
              </Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {recent.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Link href={`/trades/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                    {row.symbol}
                  </Link>
                  {row.strategyName ? (
                    <span className="truncate text-xs text-muted-foreground">{row.strategyName}</span>
                  ) : null}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.openedAt ? formatDateTimeShortInTz(row.openedAt, scope.timezone) : ""}
                  </span>
                </span>
                <PnlText value={row.netProfit} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Full list with filters on <Link href="/trades" className="underline underline-offset-2">Trades</Link>.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
