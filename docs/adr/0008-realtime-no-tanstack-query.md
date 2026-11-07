# ADR 0008: Realtime via router.refresh() — no TanStack Query

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** Spec §6.5 / task 11. Spec text says the fallback uses TanStack
  Query `refetchInterval: 5000` and that events call
  `queryClient.invalidateQueries({ queryKey: ["trades"] })`.

## Decision

The app has **no TanStack Query dependency** (nor any client data-fetching
cache): all lists/charts are Server Components with `use cache` + cache tags
 invalidated at ingest time (`revalidateDashboardCache`). Introducing a client
cache for one realtime confirmation would duplicate the app's data layer.

- On `trade.updated` (Pusher) or every 5 s (fallback, visible tab only) the
  provider calls **`router.refresh()`** — the RSC tree re-renders and the
  already-revalidated cache tags guarantee fresh data.
- The channel event carries a small **display summary** (`symbol`,
  `direction`, `price`, `profit`) lifted from the validated ingest event, so
  the "New trade: XAUUSD Buy @ 2321.35" toast needs no follow-up fetch.
- Row highlight uses a DOM `CustomEvent` (`tj:trade-updated`) decoupled from
  the provider — server-rendered rows/cards opt in with `useTradeFlash`.
- The flag (`isRealtimeEnabled`) requires **both** the server trigger
  credentials (`PUSHER_APP_ID/KEY/SECRET/CLUSTER`) **and** the public browser
  half (`NEXT_PUBLIC_PUSHER_KEY/CLUSTER`); either half missing ⇒ polling.

## Consequences

- One fewer dependency than the spec's letter; refresh behavior mathematically
  equivalent for this architecture (server data + tags).
- `router.refresh()` is valid only while its route is mounted — fine, the
  provider lives in the `(app)` layout and only matters for pages it mounts on.
- The 1 s debounce on refresh keeps queued-event bursts (EA backfill drain)
  from stacking full-tree re-renders.
