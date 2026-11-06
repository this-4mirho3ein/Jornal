# Task 08 — Trades list: query builder, filters, table, mobile cards, CSV

**Spec refs:** §11 (filters), §12.2/12.3 (layout/components) · **Depends on:** 07 (strategy/style chips)

## Goal

Server-driven, URL-state-filtered trades list with TanStack Table (desktop) + trade cards (mobile), CSV export — one shared query builder for list/export.

## Steps

1. `nuqs` install + `src/lib/search-params/trades-params.ts` — typed parsers for **all §11 filters**: date range preset+custom (from/to ISO), account (via switcher), symbol multi, direction, status, result(win/loss/be), strategies multi, style multi, setup/mistake tags multi, P/L min/max, R min/max, hasScreenshot, rating, search text, sort, page/cursor.
2. `src/features/trades/queries.ts` — single Drizzle query builder `buildTradesQuery(filters, userId)` (scoped by user→accounts) with keyset pagination, column projection (never `SELECT *`), joins for strategy/account names; reuse it for list AND CSV export AND analytics facets (counts by symbol etc. for the multi-select options).
3. `src/features/trades/csv.ts` — stream/export filtered set columns; action or `/api/trades/export` route handler returning text/csv.
4. Components (`components/shared/`):
   - `DataTable` generic (TanStack v8) + `DataTableToolbar` (column visibility, density, sticky header).
   - `FilterBar` (desktop sticky) + mobile "Filters" button → bottom Sheet with Apply/Reset footer + active-count badge; `FilterChips` removable + "Clear all"; `MultiSelect` (Combobox), `DateRangePicker` (Calendar range + presets).
   - Shared formatting `useTradeDisplay()` + `src/lib/format.ts` (money, price digits by symbol, percent, duration, date in account/user TZ — tabular-nums).
5. Trade representations: `TradeRow` (desktop: time, symbol, direction badge, volume, entry→exit, sl, net P/L PnlText signed+icon, R, strategy/style/status/account chips, rating, has-image dot) and `TradeCard` (mobile: symbol, direction, P/L, strategy chip, time, mini badges) — same data hook feeding both (responsive switch `hidden md:block`/`md:hidden`).
6. Page `src/app/(app)/trades/page.tsx`: Server Component streaming list (`<Suspense>` skeleton), search params via nuqs adapter, page size 25–50, empty state (zero trades + EA CTA), error boundary.
7. Row click → `/trades/[id]` (full page now; side-sheet arrives task 09).
8. Loading/UI states per §12.4 (skeleton, empty, error retry).

## Verification (gate)

- Unit: filter→SQL builder behavior (at least filter composition over a snapshot query), CSV column mapping, format helpers (TZ conversion, signed money, duration).
- Dev smoke: seed data → apply URL filters preserve on reload/share; chips removable; pagination stable; CSV downloads filtered set.
- Exit gate green.

## Done when

All §11 filters live server-side, URL-driven, shared builder used for export; table+cards responsive.
