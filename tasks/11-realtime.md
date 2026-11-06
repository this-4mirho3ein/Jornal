# Task 11 — Realtime: Pusher publish/subscribe + polling fallback

**Spec refs:** §6.5, §19 (feature flags) · **Depends on:** 10 (views to refresh)

## Goal

Live updates in browser within ~2 s of ingest when Pusher configured; automatic polling fallback when not; toasts + subtle row highlight — no heavy animation.

## Steps

1. `npm view pusher pusher-js version` → install both. Env: `PUSHER_APP_ID/KEY/SECRET/CLUSTER`, `NEXT_PUBLIC_PUSHER_KEY/CLUSTER` — **optional** (feature flag `isRealtimeEnabled()` from env presence, §19).
2. `src/lib/realtime/publish.ts` — replace stub: `pusher.trigger(\`private-user-${userId}\`, 'trade.updated', { accountId, tradeId, type })`; fire-and-forget with catch+log (never fails ingest). Called from ingest commit + journal mutations (revalidateTag var for cachegroups retained from task 10).
3. `/api/realtime/auth` route: Pusher channel auth verifying Better Auth session AND channel-username ownership (`private-user-<userId>` must match session user id).
4. `RealtimeProvider` (client): subscribe when enabled via `pusher-js`; on `trade.updated` → `queryClient.invalidateQueries({ queryKey: ['trades'] })` + targeted `router.refresh()` for Server-Component data; disabled → TanStack Query `refetchInterval: 5000` visible-tab-only (`refetchIntervalInBackground: false`).
5. UX: Sonner toast "New trade: XAUUSD Buy @ 2321.35" with link to trade; 1.5 s fade row highlight (CSS, respects reduced-motion); connection indicator component `ConnectionStatus` (live-connection badge in top bar, driven by last_seen_at + realtime state).
6. Tests: unit for channel-name/ownership validator; manual smoke via `send-fake-event` → toast+list update; fallback smoke with Pusher env removed.

## Verification (gate)

- Realtime path updates UI < 2 s locally; fallback polling path verified with flag off.
- Exit gate green.

## Done when

§6.5 all four points implemented incl. fallback + auth endpoint ownership check.
