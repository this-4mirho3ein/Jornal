# Task 10 — Dashboard & analytics

**Spec refs:** §10 (metrics), §9 (scalp vs swing compare), §12 (cards/charts) · **Depends on:** 08 (query builder)

## Goal

Dashboard (KPIs, equity curve, calendar heatmap, recent trades) and Analytics page (breakdowns + R distribution + scalp vs swing). SQL-aggregated, cached with tag invalidation hooks.

## Steps

1. `src/lib/metrics.ts` — typed metric computation from query results where SQL can't express it: max drawdown (from balance_snapshots), streaks, expectancy; all Decimal/string-safe; unit tests with known fixtures.
2. `src/features/dashboard/queries.ts` — KPI row (net P/L, win rate, profit factor, avg R/expectancy, best/worst, trades), equity curve (snapshots + trades join), last 30-day daily PnL for heatmap, 5 recent trades (reuse trades query builder).
3. Dashboard page: `PageHeader` + period selector (URL param, reuse filters); KPI `StatCard`s (signed colored with icons — color+icon per §12.1); Equity curve chart (shadcn Chart/Recharts, lazy `next/dynamic`); Calendar heatmap (CSS grid, semantic green/red by day PnL, tooltips); Recent trades compact list (reuse `TradeRow` condensed) + quick "Add screenshot" on latest trade (from task 09).
4. `src/features/analytics/` — queries + page: breakdowns by strategy / symbol / style / weekday / session-hour (server TZ aware) as bar charts + tables; scalp vs swing side-by-side (win rate, avg R, expectancy, profit factor, avg duration — §9 requirement); R-multiple distribution histogram.
5. Caching: `use cache`/Cache Components per installed Next docs with `cacheTag('dashboard', account+period)`; ingest path (task 05 stub) calls `revalidateTag` after commit — wire the actual invalidation call now (task 11 refines realtime).
6. All widgets: skeleton Suspense fallbacks; empty states when no data in period; charts touch-friendly (no hover-only semantics).

## Verification (gate)

- Unit: metrics fixtures (drawdown classic cases, streaks, expectancy), weekday/hour bucketing (TZ edges).
- Dev smoke: dashboard matches seed math (spot-check net P/L vs SQL sum), heatmap density sane.
- Exit gate green.

## Done when

Dashboard + Analytics complete per §10 metric list, tag-invalidation called from ingest commit, mobile-safe charts.
