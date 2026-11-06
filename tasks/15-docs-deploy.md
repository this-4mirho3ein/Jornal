# Task 15 — Docs, ADRs, deployment, end-to-end verification

**Spec refs:** §16 (deploy steps), §17 (acceptance = DoD), §20 (deliverables) · **Depends on:** 14

## Goal

README enabling a new dev to deploy in < 30 min, ADRs for key decisions, Vercel deployment executed with the user, §17 acceptance checklist walked with a demo MT5 account.

## Steps

1. `README.md` (final): architecture diagram (Mermaid: MT5 EA → /api/ingest → Postgres → Pusher → UI), tech stack table, setup (pnpm, env, docker compose), DB migrate/seed, MT5/EA install steps (link mt5/README), deployment steps §16 verbatim, env-var guide §15.1, troubleshooting, cost/free-tier notes.
2. `docs/adr/`: 0001 Neon over alternatives, 0002 EA+WebRequest over MetaApi (Option A primary), 0003 recompute-aggregates-from-deals, 0004 Pusher + polling fallback, 0005 any deviations from spec due to installed-version docs (collect from earlier phases).
3. Deployment (needs user interaction — Vercel account): guide through §16 1–9; set env vars Production+Preview; build command `pnpm db:migrate && pnpm build`; function region near Neon region (`iad1`); connect custom domain if provided; add exact app origin to MT5 WebRequest whitelist.
4. Post-deploy verification: `/api/health` OK; account+key creation; `send-fake-event` against production; EA on **demo account** → open/modify/close/partial flows visible within ~2 s; offline-queue flush test (cut internet, trade, restore); deposits excluded from PnL; invalid requests rejected.
5. Walk §17 acceptance checklist item by item; record ☑/✗ with evidence (screenshots/paths); fix blockers (loop back into phase tasks as needed).
6. Enable Vercel Analytics + Speed Insights.
7. Final tidy: remove dead code/TODOs, versionNumbers in README, tag `v1.0.0`.

## Deliverable (final §20)

1. Complete Next.js repo per §2–15 · 2. `mt5/JournalSync.mq5` · 3. Complete README · 4. `.env.example`, `drizzle/`, seed, `scripts/send-fake-event.ts` · 5. Passing CI.

## done

When §17 fully ✅ (or every gap has a documented owner/plan), update `tasks/00-INDEX.md` statuses to done.
