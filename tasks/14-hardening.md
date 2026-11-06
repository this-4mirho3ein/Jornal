# Task 14 — Hardening: security headers, cron, logging, e2e, CI

**Spec refs:** §15 (security checklist), §19 · **Depends on:** 13

##Goal
Defense-in-depth, hygiene automation, CI pipeline green.

## Steps

1. Security headers in `next.config` (CSP — allow Pusher/Pusher-WS/Vercel Blob/Neon domains, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`/frame-ancestors 'none'). Test no CSP violations in dev console.
2. Guard re-audit: every Server Action + Route Handler calls `requireUser()` + ownership scope; ingest path re-verified (401/403/413/422/429 matrix test via `send-fake-event` variants).
3. Vercel Cron: `vercel.json` → `/api/cron/prune` + `CRON_SECRET` — prune `trade_events` > 90 days, prune orphan blobs; local-testable with secret header.
4. `lib/logger.ts` structured logging finalize (levels, no secrets/PII, ingest event logging w/o key hash).
5. Husky + lint-staged: pre-commit prettier+eslint on staged; Conventional-Commits commit-msg hook (gitmoji-less, per §15.3).
6. Playwright: 1–2 e2e smoke (login → dashboard renders; trades list loads with seed) run locally (headless), `src/tests/e2e/`; not wired into CI if no DB runner — document.
7. GitHub Actions: `.github/workflows/ci.yml` — pnpm install → typecheck → lint → test → build (Node LTS matrix single version ok). Must be green (no secrets needed: unit tests only; e2e optional job skipped without DB secret).
8. Rate-limit + cache headers sanity, security review of `/api/blob/upload` (session+ownership+type+size), `/api/realtime/auth` (channel ownership).

## Verification (gate)

- 401/403/413/422/429 matrix verified; prune cron works locally; CI workflow file valid (`act --list` or push-ready lint); pre-commit hooks function.
- Exit gate green.

## Done when

§15.2 checklist all satisfied and CI config committed.
