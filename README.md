# Trading Journal

A real-time, mobile-first trading journal web app. MetaTrader 5 trades sync automatically to the site; the owner analyzes, filters, tags by strategy, and attaches screenshots.

> **Status:** under active construction — the phase-by-phase build plan lives in [`tasks/`](./tasks/), sourced from [`TRADING_JOURNAL_SPEC.md`](./TRADING_JOURNAL_SPEC.md).

## Stack

Next.js 16 (App Router, Turbopack, Cache Components) · TypeScript strict · Tailwind CSS v4 · shadcn/ui · Drizzle ORM + Postgres (Neon) · Better Auth · Vercel Blob · Upstash rate-limit · Pusher realtime.

## Getting started (early scaffold)

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

Quality gates:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## MT5 connection

MetaTrader 5 trades sync to this journal through the **`JournalSync.mq5`** Expert Advisor (desktop MT5 + WebRequest). Install, testing and troubleshooting: **[mt5/README.md](./mt5/README.md)**. Without MT5, the whole ingest pipeline can be exercised with `scripts/send-fake-event.ts`.

Full setup (database, deployment) is documented in phase 15 — see `tasks/15-docs-deploy.md`.
