# ADR 0010: Open registration (multi-user), owner-only mode behind an env flag

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** Owner request, 2026-11 (post-deploy, during task 15). Spec §15.2
  scoped the product to a single-owner install: exactly one email (`OWNER_EMAIL`)
  could ever register; the sign-up hook in `lib/auth/server` rejected everyone
  else with the generic "Registration is closed." (403). With the journal now
  deployed and being shared, the owner asked that **anyone can register and use
  it** — every visitor should be able to create an account and journal
  independently.

## Decision

- **Registration is open by default.** The Better Auth `before` hook skips its
  allowlist probe entirely for sign-ups. Better Auth still enforces unique
  emails, and its built-in production rate limiter (in-memory, 100 req / 10s,
  enabled by default per the installed v1.7.18 source) shields the endpoint;
  Upstash-backed limits remain deferred (§19, task 14).
- **Escape hatch:** `SIGNUP_MODE=owner` restores the exact §15.2 behavior —
  only `OWNER_EMAIL` may register, and only while no credential account exists.
  The predicate lives in `lib/auth/signup-policy.ts`
  (`isSignUpAllowed`, pure, unit-tested both modes). Unset or any value other
  than "owner" means open.
- **Copy updated for honesty:** register/login footers, landing hero note and
  FAQ no longer claim a single-owner install; the landing CTAs point at
  `/register` ("Get started — free").
- **Spec deviation recorded** per §0 rule 2; this ADR supersedes §15.2's
  registration clause. Auth/session mechanics (§2, §15.2 guards) are unchanged.

## Isolation prerequisites (audited before flipping)

Data was already modeled per-user, so opening registration requires no
migration:

- `trading_accounts.user_id` + `strategies.user_id` (uuid FKs, cascade on user
  delete); trades hang off accounts; journal entries off trades.
- Every read path resolves accounts through the session user:
  `getActiveAccount(userId)` → `getUserAccounts` / `getAccountById(id, userId)`
  (URL param and cookie account ids cannot cross users); dashboard KPIs,
  analytics, trades list, CSV export, trade detail (`getTradeDetail(user.id, …)`
  + `notFound()` fallback), journal autosave, blob upload and the uploads
  streaming route (trade → account → `userId` ownership join) are all
  session-guarded; the realtime auth endpoint checks channel ownership.
- A fresh registrant starts with zero accounts: empty states + the DB-derived
  onboarding checklist (task 12) drive first setup (create account → ingest
  key → EA).

## Consequences

- The deployed site is now self-serve; the production owner account should be
  registered promptly (first come, first served — any email can claim any
  address).
- Unknown abuse surface (mass registrations, storage consumption) is bounded
  only by Better Auth's in-memory limiter; if the service becomes public-facing
  in earnest, revisit Upstash-backed rate limits (§5.1.3, task 14) and consider
  an invites/closed-beta switch — `SIGNUP_MODE=owner` already provides one.
- Screenshots still use the public-access Blob store with ownership-checked
  streaming for server-put keys; the signed-URL redesign (task 15) removes the
  remaining public-CDN exposure.
