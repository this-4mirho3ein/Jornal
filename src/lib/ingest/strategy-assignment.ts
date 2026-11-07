/**
 * Strategy auto-assignment for ingested deals (spec §5.1.7, task 05).
 *
 * Precedence: EA magic number via `magic_strategy_map`, else the MT5 comment
 * carrying `S:<code>` (case-insensitive, whitespace-tolerant), else the
 * account's default strategy (owner request, 2026-11 — see ADR 0009). All
 * three miss → null (the trade stays unassigned until the user maps it —
 * task 07 UI).
 *
 * The lookup inputs are fetched ONCE per ingest request by the db layer and
 * injected here, keeping this module pure and unit-testable.
 */

export interface StrategyRef {
  id: string;
  code: string;
}

/** Per-account magic → strategyId lookup (already filtered by account). */
export type MagicMap = ReadonlyMap<number, string>;

/**
 * Extracts the strategy code from an MT5 comment, e.g.
 * `"S:ICT-OB"` → `"ICT-OB"`, `"rsi divergence S: mr"` → `"mr"`.
 * Returns null when no marker is present.
 */
export function parseStrategyCode(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const match = /(?:^|[\s,;|])S:\s*([A-Za-z0-9._-]+?)(?=$|[\s,;|])/i.exec(comment.trim());
  return match ? match[1] : null;
}

export type StrategySource = "magic" | "comment" | "default" | "none";

export interface AssignStrategyResult {
  strategyId: string | null;
  source: StrategySource;
}

export function assignStrategy({
  magic,
  comment,
  magicMap,
  strategies,
  defaultStrategyId = null,
}: {
  magic: number | null | undefined;
  comment: string | null | undefined;
  magicMap: MagicMap;
  strategies: readonly StrategyRef[];
  /** Account default (ADR 0009) — lowest precedence, never overrides magic/comment. */
  defaultStrategyId?: string | null;
}): AssignStrategyResult {
  if (magic !== null && magic !== undefined) {
    const byMagic = magicMap.get(magic);
    if (byMagic) {
      return { strategyId: byMagic, source: "magic" };
    }
  }

  const code = parseStrategyCode(comment);
  if (code) {
    const needle = code.toLowerCase();
    const byCode = strategies.find((s) => s.code.toLowerCase() === needle);
    if (byCode) {
      return { strategyId: byCode.id, source: "comment" };
    }
  }

  if (defaultStrategyId) {
    return { strategyId: defaultStrategyId, source: "default" };
  }

  return { strategyId: null, source: "none" };
}
