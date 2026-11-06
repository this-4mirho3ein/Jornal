# Task 05 — Ingest API: Zod schema, auth, rate-limit, idempotency, reducer, tests

**Spec refs:** §4.2 (wire schema), §5 (pipeline), §19 (tricks) · **Depends on:** 04

## Goal

`POST /api/ingest` implementing the full §5.1 pipeline: 64 KB limit → Bearer auth (const-time compare) → Upstash rate-limit → Zod (versioned) → account binding → idempotency via `trade_events` → **pure reducer** in one transaction → realtime publish stub → 2xx only after durable commit. Plus `scripts/send-fake-event.ts`.

## Steps

1. `npm view upstash/ratelimit @upstash/redis version` → install (+ optional Redis env; if unset → rate-limit skipped with warning log, feature-flag per §19).
2. `src/lib/ingest/schemas.ts` — Zod for §4.2 exactly: `schemaVersion: 1`, `eventId`, `type` enum, `sentAtUtc`, `account{...}` (strings→numerics via coerce), optional `position{...}`, optional `deal{...}` including `entry`/`reason` enums, `sl`/`tp` `0 = none`, price/volume/profit numerics as strings→decimals. Export inferred `IngestEvent`.
3. `src/lib/ingest/reducer.ts` — **pure core** `computeTradePatch(event, prior)` + `src/lib/ingest/reducer-db.ts` thin transaction layer:
   - `deal_open`: upsert trades by `(account_id, position_id)` (insert stub if missing — out-of-order support), insert `trade_deals`, on first insert set `opened_at`, `initial_sl/tp` (never overwritten later), `balance_at_open`, `strategy_id` (magic map → comment `S:<code>` parse), `style` auto (task 07 classifier — implement classifier here now per §9 as it is the ingest path: `classifyStyle(durationSec)`), aggregates computed from `trade_deals`.
   - `position_modify`: update current `sl/tp` only; `initial_*` untouched unless null/0.
   - `deal_close`: insert deal; recompute aggregates from `trade_deals` (sums + volume-weighted exit); remaining volume ≈ 0 → `closed`, `closed_at`, `balance_at_close`, `net_profit`, `r_multiple` (needs `risk_amount`: from tickValue/tickSize if present else null), `duration_seconds`, `close_reason`.
   - `cash_op` → `cash_operations`; every event → account touch (`last_seen_at/balance/equity`) + throttled `balance_snapshots` (≤1 per 30 s/account — compute inside tx by last snapshot time).
   - Out-of-order + duplicates handled (recompute-from-deals always).
4. `src/lib/ingest/strategy-assignment.ts` — `assignStrategy(event, { magicMap, comment })` pure; parse `S:CODE` from comment (case-insensitive, trims); fetched map cached per request. Unit tests.
5. Route `src/app/api/ingest/route.ts`: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 15`. Steps in §5.1 order: raw body 64 KB cap (413), Bearer sha256 + `crypto.timingSafeEqual` (401 generic), rate-limit 120/min per hash (429 + `Retry-After`), Zod 422 (reject unknown `schemaVersion`), account binding/claim + login mismatch 403, idempotency insert-first (duplicate → `200 { duplicate: true }`), transaction reduc2er, commit, then fire-and-forget publish hook (`src/lib/realtime/publish.ts` — no-op stub until task 11), return `200 { ok: true, tradeId }`. Structured logging via `src/lib/logger.ts` (no keys/PII).
6. `scripts/send-fake-event.ts` (tsx + fetch): args `--url --key --type --posId --symbol`; emits realistic event payloads (open/modify/close/heartbeat/cash_op) with deterministic eventIds; used for smoke tests.
7. Tests (`src/tests/unit/ingest/`): fixtures covering — open→modify→partial close→close; partial-close aggregation math; duplicate event; out-of-order close-before-open; initial_sl stability across modify/second-open; strategy via magic map vs comment; style classification edges (14:59 vs 15:01, >24 h, >2 weeks); R-multiple with and without tick value; cash_op isolation from PnL. Reducer is pure → no mocking needed except injected time.
8. Env additions: `UPSTASH_REDIS_REST_URL/TOKEN` optional (flagged), documented in `.env.example`.

## Verification (gate)

- `pnpm test` reducer suite green (the §19 trick: reducer is where correctness lives — non-negotiable coverage).
- With DB: `pnpm tsx scripts/send-fake-event.ts --url http://localhost:3000/api/ingest --key <key>` full loop → trade appears; repeat run → `{ duplicate: true }`; tampered key → 401; oversized body → 413.
- Exit gate green.

## Done when

§5.1 pipeline complete in order, out-of-order/dup safety proven by tests, fake-event script works live.
