# Task 06 — MT5 Expert Advisor `JournalSync.mq5` + EA docs

**Spec refs:** §3 (connection truth + setup), §6 (EA code), §10 (tick value recommendation) · **Depends on:** 05 (contract exists)

## Goal

Ship `mt5/JournalSync.mq5` (complete, spec §6 code _plus_ the §10 recommendation) and `mt5/README.md` install guide. This file compiles on Windows/MetaEditor — cannot be compiled here, so correctness is by review against MQL5 docs.

## Steps

1. Write `mt5/JournalSync.mq5` from spec §6 verbatim in structure/behavior, with required additions:
   - Add `tickValue`/`tickSize` to the position JSON (`SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE)` / `SYMBOL_TRADE_TICK_SIZE`) — spec §10 says add these **now** (schema stays v1; fields optional downstream).
   - Keep: deterministic eventIds (`deal:<ticket>`), disk queue `journal_queue.jsonl`, ordered flush, poison-drop on 4xx (except 408/429), heartbeat via `OnTimer`, backfill input, UTC conversion via `ServerOffsetSec()`, JSON escaping.
   - Compile-safety pass: `#property strict`, correct `StringToCharArray` usage with `WHOLE_ARRAY` + strip trailing `\0`, `FileOpen` flags, array handling.
2. `mt5/README.md`: §3.3 setup steps (WebRequest whitelist exact origin, Algo trading on, compile F7, attach to one chart, inputs `InpApiUrl`/`InpApiKey`), demo-first testing guide, §6.2 fake-event alternative, §6.3 security notes, troubleshooting table (WebRequest errors 4060/4014, URL not whitelisted, MT5 must run → VPS advice, Mac via Wine/CrossOver), §3.1 note: web terminal cannot run EAs → options A (EA + VPS, best) vs B (MetaApi adapter, later task).
3. Update root README stub linking to `mt5/README.md`.

## Verification (gate)

- Line-by-line review vs §6.1 ("EA behaviors that MUST remain") — checklist into commit message.
- Exit gate green (repo-level; MQL5 compiles only on MetaEditor — note that).

## Done when

EA file + guide committed; no behavior omitted from §6.1 checklist.
