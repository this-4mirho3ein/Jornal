# Task 07 — Strategies feature + style classifier

**Spec refs:** §9 (scalp/swing), §4.3 (strategies, magic map), §8 (page) · **Depends on:** 05 (classifier exists in ingest path)

## Goal

Strategy CRUD, magic-number→strategy mapping, comment-code parsing surfaced in UI, style classifier as shared lib (re-used by ingest + UI + tests), Strategies page.

## Steps

1. Move/confirm classifier in `src/lib/trade-style.ts` — pure `classifyStyle({ openAndClosedInSameDay?, durationSeconds, thresholds })` with §9 rules: scalp < 15 min; day 15 min–24 h & closed same trading day; swing > 1 day ≤ 2 weeks; position > 2 weeks. Thresholds configurable (from settings later; defaults constant + tests).
2. `src/features/strategies/schemas.ts` + `actions.ts` (`requireUser` → CRUD: create/update/archive strategy; upsert magic mapping) + `queries.ts`.
3. UI `src/app/(app)/strategies/page.tsx`: strategy cards/table — name, code chip (colored), default style select, description, archived toggle; magic-mapping manager per account (account select → magic→strategy rows with add/remove); "comment codes" explainer card (write `S:ICT-OB` in MT5 order comment).
4. Style override support hooks for trade detail (task 09): action `setTradeStyle` with `style_source='manual'`; "Auto" tag convention — a tiny `StyleBadge` with `source` prop in `components/shared/`.
5. Tests: `classifyStyle` boundary matrix (incl. same-day vs overnight edge per §9), comment parser cases (`S:ICT-OB`, `s:ict-ob`, no code, multi-token), uniqueness collision on strategy code.

## Verification (gate)

- Unit tests above green.
- UI smoke: create strategy → map magic 1001 → ingest fake event with magic 1001 → strategy auto-assigned (with DB + dev server).
- Exit gate green.
