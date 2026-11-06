# ADR 0003 — Auth-aware rendering under Next.js `cacheComponents`

Date: 2026-11-06 · Phase 03 · Status: accepted

## Context

The scaffold (phase 01) enables Next.js 16.4.5 `cacheComponents` (PPR). The
spec's auth design (§15.2) assumed a classic layout-level session guard
(`await session` in the `(app)` layout). Under `cacheComponents` that is a
build error: reads of `headers()`/`cookies()` outside a `<Suspense>` boundary
prevent prerendering. The installed guide
`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`
documents the supported patterns.

## Decision

- `src/lib/auth/guards.ts` exposes two helpers:
  - `getCurrentUser()` — `'use cache: private'` DAL read for Server Components,
    narrow `{ id, name, email }` return, redirects to `/login` when unset.
  - `requireUser()` — uncached guard for **every** Server Action and Route
    Handler (spec §15.2: never trust a layout check).
- `(app)/layout.tsx` does not await the session at the top level: static chrome
  prerenders, and the user area (with its unauthenticated redirect) streams in
  behind `<Suspense>`. `/login` bounces signed-in visitors from inside its own
  Suspense boundary.
- Private pages additionally export `robots: { index: false, follow: false }`.

## Consequences

- Build output shows `◐` (Partial Prerender) for app pages and `ƒ` for
  `/api/auth/*` — intended; no `instant = false` opt-outs were needed.
- Each future data page still calls `requireUser()` close to its data, so the
  streamed shell must never be treated as authorization.
