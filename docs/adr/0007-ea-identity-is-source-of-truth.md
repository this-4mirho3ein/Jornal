# ADR 0007: The EA-reported account identity is the source of truth

Date: 2026-11-07 · Status: accepted · Phase: 05 follow-up (ingest API)

## Context

Every wire event already carries an `account` snapshot straight from the
terminal (`AccountInfo*`: login, server, company, currency, leverage,
balance, equity, margin, freeMargin, marginLevel, isDemo). The original
reducer (spec §5.1.7 "account touch") only wrote identity fields when the
account row's `login` was NULL ("first-use binding"). Seeded/placeholder rows
have non-null logins, so a freshly attached MT5 could never make the journal
account become the real account — the owner saw a stale demo row and a
 disconnected-looking journal, even though events flowed.

## Decision

On every accepted event, inside the same transaction:

- `lastSeenAt` / `lastBalance` / `lastEquity` update as before;
- `broker` (company), `currency`, `isDemo` refresh from the event on **every**
  event — they carry no uniqueness constraints;
- `login` + `server` adopt the event's values whenever they differ, **unless**
  another row of the same user already holds that `(login, server)` pair —
  in that case the identity write is skipped (the pair is UNIQUE per user in
  §4.3; silently duplicating or re-keying would break histories). Events keep
  processing on the key-bound row; the owner resolves the double in Accounts.

`displayName` is never overwritten (owner's label). Rows keep their id, so
the active-account cookie, trades, and magic maps survive the adoption.

## Consequences

+ Attaching the EA fully self-configures the account: the journal row becomes
  "the account with the same account number as MetaTrader", sourced from the
  terminal itself — no manual matching.
+ Idempotent and race-safe: the guard query runs in-tx; adoption repeats
  harmlessly on every differing event.
− Two accounts reported by two different ingest keys may both adopt the same
  `(login, server)`; the second one is blocked by the guard and needs a
  manual merge (acceptable: one EA/one key per account).

Mock seed data (trades, deals, events, snapshots, cash ops, magic maps) was
pruned alongside (`scripts/prune-mock-trades.ts`) so the journal contains
only MT5-reported truth; the fake-event script grew `--login/--server/
--demo/--company` flags for testing with real identities.
