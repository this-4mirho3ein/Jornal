# Task 01 — Scaffold Next.js + shadcn/ui + tooling

**Spec refs:** §2 (stack), §12.1 (design tokens), §15.3 (structure), §0 (rules) · **Depends on:** nothing

## Goal

A clean Next.js (latest stable, App Router, Turbopack, `src/`, `@/*` alias) + TypeScript-strict app with shadcn/ui, design tokens, fonts, Prettier, Vitest, env validation, and the exact folder structure — building and testing green.

## Steps

1. Check latest versions: `npm view next version react version tailwindcss version shadcn version` — record in commit message / ADR if spec breaks (spec expects Next 16: `proxy.ts` over `middleware.ts`, async `params`/`searchParams`/`cookies()`/`headers()`, Turbopack default).
2. Scaffold into workspace root (contains `TRADING_JOURNAL_SPEC.md` + `tasks/` → if create-next-app refuses non-empty dir, temporarily move those out, scaffold, restore):
   `pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --use-pnpm --import-alias "@/*"` (+ Turbopack/default choice per CLI prompts; non-interactive flags as available).
3. Install shadcn/ui: `pnpm dlx shadcn@latest init` (neutral base), then add the §12.3 set in one command: `button input textarea label select card badge table tabs dialog alert-dialog sheet drawer dropdown-menu popover command calendar tooltip skeleton sonner separator scroll-area avatar switch checkbox slider form chart`.
4. Theme & fonts:
   - `next-themes` (dark default, class strategy) + `components/theme-provider.tsx`.
   - `next/font/google`: Inter (UI, variable) + JetBrains Mono (numbers). CSS vars `--font-sans` / `--font-mono`; numeric helper class `tabular-nums`.
   - globals.css (Tailwind v4 `@theme`): neutral grays + one brand accent; add semantic tokens `--color-profit` (green), `--color-loss` (red), `--color-open` (amber), `--color-info` (blue) for both light/dark. Low motion only, respect `prefers-reduced-motion` (§12.1).
5. Prettier: `pnpm add -D prettier prettier-plugin-tailwindcss eslint-config-prettier`; `.prettierrc`, `.prettierignore`; wire `eslint-config-prettier` last in ESLint; scripts `format` / `format:check`.
6. Vitest: `pnpm add -D vitest vite-tsconfig-paths`; `vitest.config.ts` (node env, `@/` alias resolve); scripts `test` / `test:watch`; one smoke test (e.g. `src/tests/unit/utils.test.ts` for `cn`) under `src/tests/`.
7. Env validation: `pnpm add @t3-oss/env-nextjs zod`; `src/env.js` with `shared`/`server`/`client` schemas — start with what exists (NEXT_PUBLIC_APP_URL optional); mark finalSchema import convention; **grow schemas in each later phase**; import `env` in `next.config.ts` to fail fast. No secrets fail the build yet.
8. Folder structure (§15.3): `src/features/{trades,accounts,strategies,analytics,dashboard,journal-images}`, `src/components/{ui,shared}`, `src/lib`, `src/db`, `src/tests/{unit,e2e}` (+ `.gitkeep` where empty); path alias already `@/`.
9. Scripts in package.json: `typecheck` (`tsc --noEmit`), `test`, `dev`, `build`, `lint`, `start`, `format`, `format:check`.
10. Placeholders: `mt5/.gitkeep`, `docs/adr/.gitkeep`, `scripts/.gitkeep`, stub `README.md` (replaced in task 15).
11. git init if create-next-app didn't; install hooks-free for now (husky in task 14). Initial commit: `chore: scaffold next.js app with shadcn/ui, prettier, vitest, env validation`.

## New files

`components.json`, `src/components/ui/*`, `src/components/theme-provider.tsx`, `src/app/layout.tsx` (fonts+theme), `src/app/globals.css` (tokens), `.prettierrc`, `.prettierignore`, `vitest.config.ts`, `src/tests/unit/utils.test.ts`, `src/env.js`, `src/features/**`, `src/db/**`, `src/tests/**`, `mt5/**`, `docs/adr/**`, `scripts/**`

## Verification (gate)

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
- `pnpm dev` boots, root page renders, dark mode default, fonts applied.
- `pnpm dlx shadcn@latest add button` still works (components registry healthy).

## Done when

All of the above + committed. Status row in `tasks/00-INDEX.md` updated.
