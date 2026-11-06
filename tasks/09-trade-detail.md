# Task 09 — Trade detail: key numbers, journal form, screenshots, side sheet

**Spec refs:** §8.2 (sections), §12.4 (states) · **Depends on:** 08

## Goal

Trade detail page (deep link + intercepting side sheet) with key numbers, journal editing (autosave + optimistic), deals timeline, and screenshot upload (Blob client uploads incl. clipboard paste) + gallery + lightbox.

## Steps

1. Install `@vercel/blob`, `browser-image-compression`. `src/lib/blob/` — token helper; `/api/blob/upload` route: session + trade ownership + content-type (`image/png|jpeg|webp`) + ≤8 MB → returns client-upload token (per current Vercel Blob docs; check client-upload API of installed version).
2. `src/features/journal-images/`: schemas/actions (caption, kind, delete, reorder, list); `ImageUploader` (drag-drop, click, **paste listener Ctrl/Cmd+V**, mobile camera fallback `<input accept="image/*" capture>`; client-side compression maxwidth 1920, quality ~0.8 via browser-image-compression); `ImageGallery` (kind selector, caption edit, drag reorder, delete confirm); `Lightbox` (`next/dynamic`, zoom, keyboard nav, lazy).
3. Page `src/app/(app)/trades/[id]/page.tsx` (async params!) + `@modal/(.)trades/[id]` intercepting parallel route with `<Sheet>`; deep-linkable fallback full page. Header (§8.2 #1): symbol, direction/status/account/strategy/style badges, PnlText, R-multiple.
4. Key numbers grid (#2): entry, exit, SL, TP, **initial SL**, volume, risk amount, RR planned vs achieved, duration, commission/swap/fee, balance before/after.
5. Journal form (#4): strategy select, style select (shows auto value, override → `style_source='manual'`), rating stars, emotion select, setup/mistake tags (input+chips), notes markdown textarea + preview (tiny renderer, no heavy editor). **Autosave debounce 800 ms + `useOptimistic` + "Saved" indicator**; server action `updateTradeJournal` per field-batch.
6. Timeline (#5): deals table (entry/out partials with price/volume/PnL/reason time) + SL/TP modification history from `trade_events` (query by position).
7. Dashboard surface hook: quick "Add screenshot" action on latest trade (wired fully in task 10).

## Verification (gate)

- Unit: markdown-sanitizer tests (escape HTML, code ticks), optimistic-form reducer sequence.
- Dev+DB smoke: upload via click + paste; compression applied (check size); reorder/delete persist; cancel before upload; ownership enforced (other user's trade id → 403, single-owner app: verify action guards).
- Exit gate green.

## Done when

All §8.2 six sections present and working; images never exceed serverless limits; sheet intercepts list clicks with deep-link fallback.
