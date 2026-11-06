# ADR 0004: Better Auth uses `generateId: "uuid"` to match §4.3 schema

Date: 2026-11-06 · Status: accepted · Phase: live-verification (pre-Phase-5)

## Context

Spec §4.3 defines the auth tables (`users`, `sessions`, `accounts_auth`,
`verifications`) with `uuid` primary keys defaulting to `gen_random_uuid()`
(Drizzle `defaultRandom()`).

Better Auth's installed default (1.7.18) generates its own random ids
(nanoid-style strings) client-side and inserts them into the PK columns.
On Postgres this fails the `uuid` cast at insert time — surfaced as
`APIError: Failed to create user` (`string_to_uuid`) on the first
`sign-up/email` (owner credential claim).

## Decision

Configure `advanced.database.generateId: "uuid"` in `src/lib/auth/server.ts`.
Per the installed version's own typing (`GenerateIdFn | false | "serial" |
"uuid"`), `"uuid"` uses `gen_random_uuid()` on Postgres — the same default the
schema already carries.

## Consequences

- Auth row ids are real uuid v4s, consistent with domain
  (`trading_accounts`, …) tables.
- Deviation from Better Auth defaults is intentional; DB remains the source
  of id shape (§0.2: installed docs win).
