# Task 12 — Polish: states, onboarding, a11y, reduced motion, mobile QA

**Spec refs:** §12 (design system), §12.4 (states), §13 (perf budgets) · **Depends on:** 11

## Goal

Production-feel UX: every view has loading/empty/error/success states; first-run onboarding checklist; accessibility pass; motion discipline; mobile QA at 360–1536 px.

## Steps

1. State audit: every data view (dashboard widgets, trades list, detail, analytics, strategies, accounts) — skeleton (structure-matched, no CLS), empty (CTA: "Install the EA → steps" linking mt5 README), error (retry), success. Centralized `EmptyState`, `ErrorState`, skeleton primitives.
2. Onboarding checklist (first run until first trade received): 1. Create account 2. Copy ingest key 3. Install EA 4. First trade received ✔ — derive state from DB (accounts exist? key created? last_seen_at? trades count) — shown on dashboard, dismissible.
3. A11y pass: focus rings visible everywhere, ARIA labels on icon buttons, keyboard navigation for table (row activation), dialogs/sheets focus traps (Radix default), 44×44 px touch targets on mobile controls, color-blind safety (P/L always sign+icon+color), labels for all form controls.
4. Motion: only 120–200 ms opacity/transform transitions; sheet/dialog enter-exit; global `prefers-reduced-motion` respected (disable non-essential).
5. Mobile QA at 360/390/768/1024/1280/1536: bottom tab bar (Dashboard, Trades, Analytics, Accounts, More) with safe-area insets; tables→cards switch; filter bottom sheet; detail full-screen sticky header; no horizontal scroll at 360 px; charts horizontally scrollable if needed.
6. Micro-copy + consistency: button variants, spacing rhythm 4/8 px, radius, border-not-shadow audit; loading text conventions.
7. `next.config` reactCompiler if stable (verify docs) — re-render hygiene.
8. **Branding & theming (added per owner, 2026-11):** the official "Trading Journal Growth" logo lives at `public/brand/logo.png` (square favicon/apple-icon already generated at `src/app/icon.png` + `src/app/apple-icon.png`). Finish: logo in header/login/OG image/PWA manifest icons (light-theme variant if needed); light/dark `ThemeToggle` (dark is default, §12.1) present in the app header **and** reachable on mobile; then QA every view in both themes.

## Verification (gate)

- Checklist-driven pass at each breakpoint (record results); axe/lighthouse a11y ≥ 95 on app pages (informational while app is auth-gated).
- Exit gate green.

## Done when

No missing states, no a11y blockers, mobile flows comfortable at 360 px.
