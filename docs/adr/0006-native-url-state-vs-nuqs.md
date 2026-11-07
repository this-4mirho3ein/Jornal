# ADR 0006: Native URL state for trades filters (no `nuqs`, no TanStack Table)

Date: 2026-11-07 · Status: accepted · Phase: 08 (trades list)

## Context

Spec §11 and `tasks/08-trades-list.md` prescribe `nuqs` for URL filter state
and a generic TanStack v8 `DataTable` for the trades list. Two constraints
from spec §0 rule 2 (never guess versions; the installed version's docs win)
drive a deviation:

1. This project runs Next.js 16.4.5 with `cacheComponents`/PPR and the React
   Compiler (AGENTS.md: "This is NOT the Next.js you know"). Both libs are
   client-state adapters whose integration surfaces (shallow `router` updates,
   `NuqsAdapter`, table state mirrors) assume the older App Router mental
   model; adopting them unverified against this exact Next version adds the
   exact kind of second-order risk the rule bans.
2. The spec's *requirements* — URL-lived, shareable, back-button-friendly,
   server-rendered filters; server-side filtering/sorting/pagination; one
   shared query builder for page + export — are all satisfied without either
   library.

## Decision

- Filters are **native URL search params**: the page awaits `searchParams`
  inside `<Suspense>` (cacheComponents rule), `parseTradesFilters` validates
  every param independently with Zod (crafted URLs can never 500 the page),
  and `tradesFiltersToQuery` is the single canonical serializer used by the
  filter forms (client `router.push`), the removable chips, the pagination,
  and the CSV export link.
- The desktop table is **plain server-rendered `<Table>` markup** with a
  sticky header and `tabular-nums`; mobile cards are the same rows via
  `hidden md:block` / `md:hidden` (§12.2). No client table library.
- Pagination is **offset + `page`** (25/rows) rather than keyset: page
  numbers must stay shareable/bookmarkable per §11's URL-first contract; the
  composite sort key ends with `asc(trades.id)` for stable windows.

## Consequences

+ Two fewer dependencies to re-verify on every Next/React upgrade; all
  filtering logic is one testable Zod/Drizzle layer (unit-tested, no DOM).
+ Every per-phase gate stays dependency-free.
− Column-visibility/density toggles and client-side niceties are deferred to
  the polish task (12) where they can be built on measured need.
− `hasScreenshot`/notes-driven filters that depend on the journal tables
  (task 09) are parsed but not yet exposed in the UI.
