# Task 13 — SEO & performance

**Spec refs:** §13 (perf), §14 (SEO) · **Depends on:** 12

## Goal

Lighthouse ≥ 95 (all four) on landing; fast app pages (streaming, no CLS); full metadata/OG/sitemap/JSON-LD; PWA-lite manifest.

## Steps

1. Landing page `(marketing)/page.tsx` (public): hero (what the journal does), features grid (realtime MT5 sync, strategies, R-multiples, screenshots), screenshots/demo visuals, FAQ; semantic HTML single `<h1>`, alt texts; Login CTA → installs-auth.
2. Metadata: `app/layout.tsx` `generateMetadata` — `title.template`, description, `metadataBase` (from NEXT_PUBLIC_APP_URL), canonical, OG + Twitter cards; `opengraph-image.tsx` (edge-rendered OG); all private pages already `noindex` (verify sweep).
3. `sitemap.ts` (public only), `robots.ts` (disallow `/dashboard`, `/trades`, `/api`, app pages), `manifest.ts` + icons (PWA-lite add-to-home-screen), `lang="en"`, `not-found.tsx`, `error.tsx`, `global-error.tsx`.
4. JSON-LD: `SoftwareApplication` + `FAQPage` on landing (structured-data validated).
5. Perf tuning: bundle analyze (`ANALYZE=true` script, @next/bundle-analyzer) — lazy-load charts/lightbox, individual icon imports, no heavy deps; `next/font` display swap latin subset; images `next/image` with sizes + blur placeholders (stored from task 09); keep first-load JS lean; keyset pagination verified; `use cache` coverage for aggregates.
6. Targets check: LCP < 2.0 s, CLS < 0.05, INP < 200 ms local Lighthouse run on `/` (and smoke app pages).

## Verification (gate)

- Lighthouse ≥ 95 P/A/BP/SEO on landing (report results honestly; iterate until pass or note blockers).
- Structured data + sitemap/robots validated; OG image renders.
- Exit gate green.

## Done when

SEO surface complete per §14 and perf targets hit or documented with concrete numbers.
