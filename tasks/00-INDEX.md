# Trading Journal — Master Task Index

Source of truth: `/TRADING_JOURNAL_SPEC.md` (repo root). This folder breaks spec §18 (Implementation Phases) into sequential, verifiable tasks. **Execute strictly in order. Never start a phase until the previous phase's exit gate is green.**

## Operating rules (spec §0 — apply to EVERY task)

1. Finish and verify each phase before starting the next.
2. Never guess versions — `npm view <pkg> version` first; the **installed version's docs win** over this spec. Record deviations in `docs/adr/`.
3. TypeScript strict, no `any`, Zod-validate every external input.
4. DRY: shared logic → `lib/`, shared UI → `components/`.
5. Server Components by default; `"use client"` only for interactive leaves.
6. No secrets in client code.
7. Money/prices are `numeric` in Postgres, strings or `decimal.js` in TS — never floats for arithmetic.
8. Everything idempotent (ingest may be retried).
9. **Phase exit gate:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
10. Conventional Commits, one (or more) per phase. Workspace root = repo root.

## Phase order

| #   | File                                                     | Phase                                            | Key spec sections | Status                                                                                                       | Gate                      |
| --- | -------------------------------------------------------- | ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------- |
| 01  | [01-scaffold.md](./01-scaffold.md)                       | Next.js scaffold + shadcn/ui + tooling           | §2, §12.1, §15.3  | ✅ done                                                                                                      | typecheck/lint/test/build |
| 02  | [02-database.md](./02-database.md)                       | Drizzle schema, migrations, seed                 | §4.3, §7          | ✅ done (migrated + seeded on local Postgres 17 via brew; seed made idempotent, dealId collision fixed)       | migrate OK, build         |
| 03  | [03-auth.md](./03-auth.md)                               | Better Auth, owner-only, app guard               | §2, §15.2         | ✅ done (live sign-in verified: 200 + session cookie + authed pages; ADR 0004 uuid ids)                       | gate green                |
| 04  | [04-accounts.md](./04-accounts.md)                       | Accounts CRUD, ingest keys, switcher             | §5.3, §8.1        | ✅ done (authed /accounts returns 200 with seeded rows; full UI smoke still in task 15)                       | gate + UI smoke           |
| 05  | [05-ingest-api.md](./05-ingest-api.md)                   | Ingest API + reducer + tests + fake-event script | §4.2, §5, §6.2    | ✅ done (live smoke vs local Postgres: full loop, dup, 401/422/413; 50/50 tests; ADR 0005; **ADR 0007 EA-identity adopt + mock pruned**) | reducer unit tests pass   |
| 06  | [06-expert-advisor.md](./06-expert-advisor.md)           | `mt5/JournalSync.mq5` + EA docs                  | §3, §6, §10       | ✅ done (§6.1 checklist verified in review; §10 tick fields sent; wire schema aligned w/ §6 volume:0 + contract tests 57/57; live smoke re-verified) | file + docs reviewed      |
| 07  | [07-strategies.md](./07-strategies.md)                   | Strategies CRUD, magic map, style classifier     | §9, §4.3          | ✅ done (classifier already in lib w/ tests; CRUD + magic-map UI; smoke: magic 1001 → auto-assign PASS; 65/65 tests) | classifier unit tests     |
| 08  | [08-trades-list.md](./08-trades-list.md)                 | Trades table, URL filters, CSV export            | §11, §12.2–12.3   | ✅ done (86/86 tests; native URL state per ADR 0006; live smoke: seeded rows + filters + CSV export PASS; row-detail link lands w/ task 09) | gate + filters URLs       |
| 09  | [09-trade-detail.md](./09-trade-detail.md)               | Trade detail, journal form, screenshots, sheet   | §8.2              | ✅ done (92/92 tests; detail+sheet+deep link; autosave journal; uploads via local driver w/ Blob driver ready (server-put; client-upload deferred→15); smoke: 201 upload+200 stream+cleanup PASS) | gate + upload flow        |
| 10  | [10-dashboard-analytics.md](./10-dashboard-analytics.md) | KPIs, equity curve, heatmap, breakdowns          | §10, §9           | ☐ pending                                                                                                    | gate + metrics tests      |
| 11  | [11-realtime.md](./11-realtime.md)                       | Pusher + polling fallback, toasts                | §6.5              | ☐ pending                                                                                                    | gate + fallback works     |
| 12  | [12-polish.md](./12-polish.md)                           | Empty/error/loading, onboarding, a11y, mobile QA, **logo + light/dark theme switcher QA (owner add)** | §12, §13          | ☐ pending                                                                                                    | 360px QA, contrast        |
| 13  | [13-seo-perf.md](./13-seo-perf.md)                       | Landing, metadata, sitemap, OG, perf tuning      | §13, §14          | ☐ pending                                                                                                    | Lighthouse ≥ 95 landing   |
| 14  | [14-hardening.md](./14-hardening.md)                     | Security headers, cron, logging, e2e, CI         | §15, §16          | ☐ pending                                                                                                    | CI green                  |
| 15  | [15-docs-deploy.md](./15-docs-deploy.md)                 | README, ADRs, Vercel deploy, end-to-end verify   | §16, §17, §20     | ☐ pending                                                                                                    | acceptance checklist §17  |

## Session conventions

- Repo root: `/Users/amirhoseinabbasi/Desktop/programing/Jornal`. The spec file stays at root.
- Package manager: **pnpm** (installed: 10.25.0; Node 26).
- Update the Status/Gate column above after every phase + keep `docs/adr/` for deviations.
- When a phase needs a service not yet present (Neon, Redis, Blob, Pusher), wire it with **graceful fallback/feature flags via env** (spec §19) so builds and tests stay green locally; real secrets are added at deploy.
