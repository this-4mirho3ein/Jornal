# Task 04 — Accounts feature: CRUD, ingest keys, connection status, switcher

**Spec refs:** §5.3 (keys), §8.1 (switcher/renaming) · **Depends on:** 03

## Goal

Owner can manage trading accounts: create, **rename anytime**, archive, create/rotate ingest keys (hash-only storage, shown once), see connection status (heartbeat), and switch accounts globally via URL+cookie.

## Steps

1. `src/features/accounts/schemas.ts` — Zod: createAccount (displayName optional, defaults `Login <login>` on first bind), renameAccount, rotateKey, archiveAccount.
2. `src/features/accounts/actions.ts` — Server Actions (`"use server"`), each: `requireUser()` → ownership check → Zod → DB. `createAccountWithKey` (generates 32-byte base58/base64url key `tj_<24hex>`; store `sha256` hash + 6-char prefix; **return key once**), `renameAccount`, `rotateIngestKey`, `archiveAccount` (soft), `updateTimezone`. Revalidate paths.
3. `src/features/accounts/queries.ts` — `getUserAccounts(userId)` (incl. `last_seen_at`, `last_balance`, `last_equity`), `getAccountById`, `resolveActiveAccountForPages(userId, cookieOrUrlId)` (validates ownership; falls back to first account).
4. Connection status helper `src/features/accounts/connection.ts`: pure `connectionLevel(lastSeen, now)` → `live (<3 min) | delayed (<15 min) | offline`; unit tests.
5. Key generator `src/features/accounts/key.ts`: pure `generateIngestKey()`, `hashIngestKey(key)` (SHA-256 hex) — unit tests.
6. UI: `src/app/(app)/accounts/page.tsx` (Server Component) — account list (name, masked login `••••<4last>`, broker/server, DEMO/LIVE badge, connection dot, last seen in user TZ, balance/equity, actions menu). Create dialog → returns one-time key screen with CopyButton + "I saved it" confirm. Rename inline (popover input). Rotate with ConfirmDialog.
7. Account switcher (§8.1): `components/shared/account-switcher.tsx` — Popover+Command list with `display_name`, masked login, broker, badge, connection dot; option "All accounts" (only selectable if single currency across accounts — else disabled with tooltip); sets `?account=<id>` via router + writes cookie `tj_account`; used in `(app)` top bar. Read in Server Components via cookie — helper `src/features/accounts/active-account.ts` (`getActiveAccount(baseUrl, userId)` resolving URL param or cookie).
8. Charts-free dashboard-ready data not needed yet. Empty state for zero accounts with CTA "Add your first account".
9. First-run bind support: actions `bindLoginFirstUse` used later by ingest (task 05) — schema-level only; do not implement ingest here.

## Verification (gate)

- Unit: `connectionLevel`, `generateIngestKey`/`hashIngestKey` (deterministic hash, prefix), ownership guard behavior (DB-backed test via test containers if available; else logic-level).
- UI smoke via `pnpm dev` with DB: create → copy key (only once) → rename → rotate → archived hidden.
- Exit gate green.

## Done when

All routes/actions enforce auth+ownership; name change reflects in switcher list; key shown once and only hash/prefix in DB.
