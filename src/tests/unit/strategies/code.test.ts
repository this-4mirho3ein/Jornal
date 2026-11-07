import { describe, expect, it } from "vitest";

import {
  deriveStrategyCode,
  strategyCodeBase,
} from "@/features/strategies/code";

describe("strategyCodeBase (name → MT5 comment code)", () => {
  it("slugifies names to A-Z0-9 with single dashes", () => {
    expect(strategyCodeBase("ICT Silver Bullet")).toBe("ICT-SILVER-BULLET");
    expect(strategyCodeBase("london  breakout!")).toBe("LONDON-BREAKOUT");
    expect(strategyCodeBase("SMC / OB v2")).toBe("SMC-OB-V2");
  });

  it("caps at 24 chars", () => {
    const base = strategyCodeBase("A very long strategy name indeed");
    expect(base).toBe("A-VERY-LONG-STRATEGY-NAM");
    expect(base.length).toBeLessThanOrEqual(24);
  });

  it("falls back to STRAT when the name has no usable characters", () => {
    expect(strategyCodeBase("!!!")).toBe("STRAT");
    expect(strategyCodeBase("")).toBe("STRAT");
  });
});

describe("deriveStrategyCode (unique per user)", () => {
  it("returns the base when unused", () => {
    expect(deriveStrategyCode("Mean Reversion", [])).toBe("MEAN-REVERSION");
  });

  it("ignores unrelated taken codes", () => {
    expect(deriveStrategyCode("Breakout", ["ICT-SB", "MR"])).toBe("BREAKOUT");
  });

  it("de-duplicates case-insensitively with -2, -3 suffixes", () => {
    expect(deriveStrategyCode("Mean Reversion", ["MEAN-REVERSION"])).toBe(
      "MEAN-REVERSION-2",
    );
    expect(
      deriveStrategyCode("Mean Reversion", ["mean-reversion", "MEAN-REVERSION-2"]),
    ).toBe("MEAN-REVERSION-3");
  });

  it("suffix never pushes the code past the 24-char cap", () => {
    const base = "A-VERY-LONG-STRATEGY-NAM";
    const next = deriveStrategyCode("A very long strategy name indeed", [base]);
    expect(next.length).toBeLessThanOrEqual(24);
    expect(next).toBe("A-VERY-LONG-STRATEGY-N-2");
    expect(
      deriveStrategyCode("A very long strategy name indeed", [
        base,
        "A-VERY-LONG-STRATEGY-N-2",
      ]),
    ).toBe("A-VERY-LONG-STRATEGY-N-3");
  });
});
