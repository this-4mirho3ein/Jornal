# ADR 0009: Strategy codes auto-derived + per-account default strategy

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** Owner request, 2026-11 (between tasks 12 and 13). Two deviations
  from the spec letter:

  1. Spec §6.1 (and the task 07 UI) treat `code` as a user-typed field —
     the strategy form asked for it.
  2. Spec §5.1.7 says strategy assignment is magic map → `S:comment` code →
     **unassigned**. The owner wants every new trade tagged: a **default
     strategy per trading account** fills the gap.

## Decision

- **Codes are derived, never typed** (`features/strategies/code.ts`): the
  create action slugifies the name (`ICT Silver Bullet` → `ICT-SILVER-BULLET`,
  A-Z0-9, ≤ 24 chars) and de-duplicates per user with `-2, -3…` suffixes. The
  form no longer has a code field; renames keep the code stable so existing
  MT5 comments keep matching. The `S:<code>` comment contract (§6.1) and the
  case-insensitive matcher are unchanged — only the source of the code moved.
- **`trading_accounts.default_strategy_id`** (uuid FK → strategies, `set null`
  on delete; migration `0002_careful_killer_shrike.sql`). Precedence in
  `assignStrategy` becomes **magic → comment → account default → unassigned**;
  the default never overrides magic or comment. One strategy can be the
  default of several accounts, and defaults are per account by construction.
- **UI:** strategy cards get a ★ Default toggle scoped to the **active
  account** (the header switcher's selection); the page shows an explainer of
  which account the toggle acts on. Archived strategies can't become default.

## Consequences

- Creating a strategy is one knob simpler; codes stay unique via the existing
  `(user_id, code)` unique index (derived codes are case-insensitively checked
  before insert).
- Seed no longer fabricates the four demo strategies / magic mappings —
  `/strategies` starts empty; mappings are user-configured (mock removal
  request, 2026-11).
- A rebound/deleted strategy clears the pointer automatically (`set null`),
  ingests never see a dangling default.
