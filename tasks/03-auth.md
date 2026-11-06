# Task 03 — Auth: Better Auth, owner-only registration, app guard

**Spec refs:** §2 (stack), §15.2 (security) · **Depends on:** 02

## Goal

Email+password auth with Better Auth (latest) for a **single owner**: registration restricted to `OWNER_EMAIL` (+ disabled once the owner exists), protected `(app)` route group, login page, logout, session-aware guards inside every Server Action/Route Handler.

## Steps

1. `npm view better-auth version` → install `better-auth`.
2. Env: add to `src/env.js` server schema — `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OWNER_EMAIL` (required from this phase on; provide dev defaults in `.env.local`).
3. Server: `src/lib/auth/server.ts` → `betterAuth({ database: drizzle db, emailAndPassword: { enabled: true }, plugins: [ ] })` with `user: { modelName: 'users' }`, sessions → `sessions`, additional/secondary model `accounts_auth` (map Better Auth's `account` model name), advanced options per current docs.
4. Schema alignment: `pnpm dlx @better-auth/cli generate` → reconcile with existing `users` table from task 02 (keep uuid PKs, existing fields; add missing: sessions, accounts_auth, verification tables) → `db:generate` + `db:migrate`.
5. Route: `src/app/api/auth/[...all]/route.ts` (toNextJsHandler).
6. Owner-only registration: in `betterAuth` hooks (`before`), allow `signUp` only when email matches `OWNER_EMAIL` AND no user exists yet; otherwise throw APIError `FORBIDDEN` with generic message (spec §15.2: registration disabled after owner is created).
7. Pages:
   - `src/app/(auth)/login/page.tsx` — email+password form: `react-hook-form` + zod resolver, `authClient.signIn.email`, error states, redirect to `/dashboard`, server-side redirect to `/dashboard` when already signed in.
   - Keep a minimal `(auth)` layout (centered card, logo, theme applied).
8. App guard: `src/app/(app)/layout.tsx` — `const session = await auth.api.getSession({ headers: await headers() })` (async!); `redirect('/login')` if absent; passes `user` down; **also** export `requireUser()` helper in `src/lib/auth/guards.ts` used by every Server Action/Route Handler later (never trust layout alone — spec §15.2).
9. `(app)` layout shell placeholder: top bar with user menu (dropdown: logout) + sidebar nav skeleton (Dashboard, Trades, Analytics, Strategies, Accounts, Settings) — real pages in later tasks; mobile bottom tab bar in task 12.
10. Client auth: `src/lib/auth/client.ts` → `createAuthClient()`.
11. Private pages: add `export const metadata = { robots: { index: false, follow: false } }` to `(app)` and `(auth)` (full SEO in task 13).
12. Tests: unit test for the owner-allowlist predicate (`isOwnerAllowedToSignUp(email)` pure fn) under `src/tests/unit/`.

## Verification (gate)

- `docker`/DB on: manual flow — visit `/dashboard` unauthenticated → redirect `/login`; sign up with matching OWNER_EMAIL → lands in app; sign out → `/login`; second signup attempt (or non-owner email) rejected. If DB unavailable locally, defer runtime flow to task 15 with notes, but **schema+build must be real**.
- Exit gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Done when

Auth flow works end-to-end (or documented as pending-live-DB), owner restriction enforced server-side, guards helper exists and is used.
