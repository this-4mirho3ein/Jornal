/**
 * Strategy codes (spec §6.1) are still typed into MT5 order comments, but the
 * owner never writes them (owner request, 2026-11): the server derives a
 * code from the strategy name at create time, keeping it unique per user.
 */

/**
 * `ICT Silver Bullet` → `ICT-SILVER-BULLET`; anything outside A-Z0-9 collapses
 * to a single dash. A name with no usable characters falls back to `STRAT`.
 */
export function strategyCodeBase(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
  return base || "STRAT";
}

/**
 * Unique code for one user: the name slug, de-duplicated with `-2`, `-3` …
 * `taken` holds the user's existing codes (case-insensitive comparison —
 * the ingest matcher is case-insensitive too). Honors the 24-char cap so the
 * suffix never pushes the code past it.
 */
export function deriveStrategyCode(name: string, taken: readonly string[]): string {
  const base = strategyCodeBase(name);
  const takenLower = new Set(taken.map((code) => code.toLowerCase()));
  if (!takenLower.has(base.toLowerCase())) return base;
  for (let i = 2; i < 1_000; i += 1) {
    const suffix = `-${i}`;
    const candidate = base.slice(0, 24 - suffix.length) + suffix;
    if (!takenLower.has(candidate.toLowerCase())) return candidate;
  }
  // Unreachable in practice (999 codes off one name) — deterministic out.
  return `${base.slice(0, 10)}-${Date.now().toString(36).toUpperCase()}`;
}
