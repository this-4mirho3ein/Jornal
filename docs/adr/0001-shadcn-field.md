# ADR 0001 — shadcn/ui v4: `form` component replaced by `field`

Date: 2026-11-06 · Phase 01 · Status: accepted

## Context

The spec (§12.1) listed shadcn/ui's `form` component among the primitives to add.
`pnpm dlx shadcn@latest init/add` (CLI 4.23.0, radix-nova preset) no longer offers
`form`; adding it is a silent no-op, and `npx shadcn add field` is the supported
replacement for React Hook Form composition in Tailwind v4. The `cn` helper also
moved from hand-rolled clsx + tailwind-merge to the `cn` package.

## Decision

- Use `field` (Field/FieldLabel/FieldError/FieldGroup) with react-hook-form +
  `@hookform/resolvers` zod schemas for all forms, starting with login (task 03).
- Keep the installed CLI's TypeScript/Lucide defaults (docs-win rule, spec §0.2).

## Consequences

- Form accessibility wiring shifts from `<Form>` context to per-field
  `aria-invalid` + `FieldError`; later forms (tasks 04, 07, 09) follow this idiom.
- Spec's list of primitives is treated as indicative, not exhaustive.
