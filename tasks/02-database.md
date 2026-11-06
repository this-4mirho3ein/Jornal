# Task 02 — Database: Drizzle schema, migrations, client, seed

**Spec refs:** §4.3 (schema), §7 (Neon/Drizzle), §15.1 (env) · **Depends on:** 01

## Goal

The complete journal data model in Drizzle with `numeric` money columns, uuid PKs, `timestamptz`, unique constraints, indexes, a DB client that supports transactions (ingest), migrations committed to the repo, and a seed script.

## Steps

1. Check versions: `npm view drizzle-orm version drizzle-kit version @neondatabase/serverless version decimal.js version`.
2. Install: `drizzle-orm @neondatabase/serverless decimal.js` + dev `drizzle-kit tsx`.
3. Environment: create full `.env.example` from spec §15.1. Create `.env.local` for local dev with a local Postgres URL (docker-compose below) — never commit it. Extend `src/env.js`: `DATABASE_URL` required **only when `DATABASE_URL` env is present at all**? No — make it required at runtime usage; validation object: `server.DATABASE_URL` optional in scaffold stage but consumed with a clear error in `src/db/client.ts` (the DB is first used in tasks 4–5). `DATABASE_URL_UNPOOLED` optional (used by drizzle.config).
4. `docker-compose.yml`: `postgres:17-alpine` (port 5432, volume, `POSTGRES_PASSWORD=postgres`, db `journal`) for local dev. Do NOT require Docker to run the build.
5. `src/db/schema.ts` — implement every table from §4.3 with exact columns/types:
   - pgEnums: `direction(buy,sell)`, `trade_status(open,closed)`, `trade_style(scalp,day,swing,position)`, `style_source(auto,manual)`, `deal_entry(in,out,inout,out_by)`, `deal_reason(client,mobile,web,expert,sl,tp,so,other)`, `image_kind(entry,exit,htf,other)`, `cash_op_type(deposit,withdrawal,bonus,credit,correction)` (+ `emotion` free set: fear,greed,fomo,revenge,confident,neutral,uncertain — nullable).
   - `users` — minimal Better-Auth-compatible placeholder now (`id uuid pk`, `email unique`, `name`, `created_at`); Better Auth owns it from task 03 (adjust via its CLI schema).
   - `trading_accounts` — per spec, unique `(user_id, login, server)`; `ingest_key_hash` unique? No — hash lookup, index it; never store raw key; `ingest_key_prefix` (6 chars).
   - `strategies` (+ unique `(user_id, code)`), `magic_strategy_map` (pk `(account_id, magic)`), `trades` (all fields + unique `(account_id, position_id)` + all listed indexes), `trade_deals` (unique `(account_id, deal_id)`), `trade_events` (jsonb payload; unique `(account_id, event_id)`), `trade_images`, `balance_snapshots`, `cash_operations`.
   - numeric columns: prices `numeric(18,5)`, money `numeric(18,2)`, volumes `numeric(18,2)`; bigints as `bigint({ mode: 'number' })` (deal/position/order ids stay within JS-safe range for tickets; use number).
   - `createdAt/updatedAt` on mutable tables (`$onUpdate`).
6. `src/db/client.ts`: `drizzle(neon-serverless Pool(DATABASE_URL))` exporting `db` + `schema`; transactions supported via `db.transaction`. Neon-http **not** used for tx (spec §7 note) — use `neon-serverless` driver.
7. `drizzle.config.ts`: dialect postgres, schema `src/db/schema.ts`, out `./drizzle`, `dbCredentials.url = DATABASE_URL_UNPOOLED ?? DATABASE_URL`.
8. Migrations: `pnpm db:generate` → review SQL → `drizzle/` committed. `pnpm db:migrate` uses node script (`drizzle-orm/node-postgres/migrator` or neon migrator per docs) run by `tsx src/db/migrate.ts`.
9. `src/db/seed.ts`: demo user, 2 trading accounts (LIVE + DEMO), 4 strategies, ~30 realistic closed trades across symbols/durations/partial closes, balance snapshots; deterministic RNG for stable test data. Run with `pnpm db:seed`.
10. Package scripts: `db:generate`, `db:migrate`, `db:push` (drizzle-kit push), `db:studio`, `db:seed`.
11. `src/lib/decimal.ts` thin helpers if needed elsewhere (money→string normalize + safe Decimal factory). Numeric columns in Drizzle throw by default returning strings — set `mode: 'string'` explicitly where supported.

## Verification (gate)

- `pnpm db:generate` produces clean SQL; no `any`.
- If Docker running: `pnpm db:migrate && pnpm db:seed` succeed against `docker compose up -d postgres`; spot-check rows with `db:studio` or psql. If Docker unavailable: migrate/seed deferred, note in INDEX — schema still must typecheck and build.
- Exit gate: typecheck, lint, test, build all pass.

## Done when

Schema matches §4.3 1:1 (column names, constraints, indexes), migrations in repo, seed script works or documented as blocked-only-by-Docker.
