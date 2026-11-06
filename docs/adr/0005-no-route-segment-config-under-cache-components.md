# ADR 0005: No `runtime`/`dynamic` route segment configs under cacheComponents

Date: 2026-11-06 · Status: accepted · Phase: 05 (ingest API)

## Context

Spec §5 asks for `export const runtime = "nodejs"` and
`export const dynamic = "force-dynamic"` on `/api/ingest`. This project runs
Next.js 16 with `cacheComponents` enabled (ADR 0001, spec §0 rule 2: installed
docs win). The installed docs state that cacheComponents requires the Node.js
runtime and **forbids the `runtime` segment config**, and that
`dynamic = "force-dynamic"` must be **removed** — request-time APIs already
run at request time and POST handlers are never cached.

## Decision

`src/app/api/ingest/route.ts` exports only `maxDuration = 15`. Behavior is
identical: the handler executes on Node.js for every request, and 2xx is
returned only after the durable commit (§5.1.9).

## Consequences

- The §5.1 pipeline order and contract are unchanged; only the declarations
  dropped.
- Future route handlers (`/api/blob/upload`, `/api/cron/*`) follow the same
  pattern: no `runtime`, no `dynamic`.
