/**
 * Strategy feature zod schemas (task 07 / spec §9, §4.3).
 *
 * The gaps that actually matter:
 *   - codes canonicalize to UPPERCASE (the ingest parser matches
 *     case-insensitively, so `S:ict-ob` must hit the `ICT-OB` row);
 *   - colors are strict hex or empty (chips render inline styles);
 *   - magic must cover MT5's int32 range INCLUDING 0 — magic 0 is what
 *     EA-less/manual positions carry on some brokers.
 */
import { describe, expect, it } from "vitest";

import {
  createStrategySchema,
  setMagicMappingSchema,
  setTradeStyleSchema,
  updateStrategySchema,
} from "@/features/strategies/schemas";

describe("createStrategySchema", () => {
  it("uppercases codes and trims input", () => {
    const parsed = createStrategySchema.parse({ name: "ICT OB", code: " ict-ob " });
    expect(parsed.code).toBe("ICT-OB");
  });

  it("rejects codes with characters outside the wire-safe set", () => {
    expect(createStrategySchema.safeParse({ name: "X", code: "ICT OB!" }).success).toBe(
      false,
    );
    expect(createStrategySchema.safeParse({ name: "X", code: "" }).success).toBe(false);
  });

  it("accepts empty color but rejects non-hex colors, lowercasing valid ones", () => {
    const ok = createStrategySchema.parse({ name: "X", code: "A", color: "" });
    expect(ok.color).toBe("");
    const hex = createStrategySchema.parse({ name: "X", code: "A", color: "#22C55E" });
    expect(hex.color).toBe("#22c55e");
    expect(createStrategySchema.safeParse({ name: "X", code: "A", color: "red" }).success).toBe(
      false,
    );
  });

  it("rejects unknown default styles and empty names", () => {
    expect(
      createStrategySchema.safeParse({ name: "X", code: "A", defaultStyle: "scalp" })
        .success,
    ).toBe(true);
    expect(
      createStrategySchema.safeParse({ name: "X", code: "A", defaultStyle: "news" })
        .success,
    ).toBe(false);
    expect(createStrategySchema.safeParse({ name: "  ", code: "A" }).success).toBe(false);
  });
});

describe("updateStrategySchema", () => {
  it("requires a valid strategy id", () => {
    expect(
      updateStrategySchema.safeParse({ strategyId: "not-a-uuid", name: "X", code: "A" })
        .success,
    ).toBe(false);
    expect(
      updateStrategySchema.safeParse({
        strategyId: "11111111-1111-4111-8111-111111111111",
        name: "X",
        code: "A",
      }).success,
    ).toBe(true);
  });
});

describe("setMagicMappingSchema — MT5 magic is int32, 0 included", () => {
  const base = {
    accountId: "22222222-2222-4222-8222-222222222222",
    strategyId: "11111111-1111-4111-8111-111111111111",
  };

  it("accepts 0 and the int32 maximum", () => {
    expect(setMagicMappingSchema.safeParse({ ...base, magic: 0 }).success).toBe(true);
    expect(
      setMagicMappingSchema.safeParse({ ...base, magic: 2_147_483_647 }).success,
    ).toBe(true);
  });

  it("rejects negatives, overflow and non-integers", () => {
    expect(setMagicMappingSchema.safeParse({ ...base, magic: -1 }).success).toBe(false);
    expect(
      setMagicMappingSchema.safeParse({ ...base, magic: 2_147_483_648 }).success,
    ).toBe(false);
    expect(setMagicMappingSchema.safeParse({ ...base, magic: 1.5 }).success).toBe(false);
  });
});

describe("setTradeStyleSchema — manual override hook (§9)", () => {
  it("accepts only the four §9 styles", () => {
    expect(
      setTradeStyleSchema.safeParse({
        tradeId: "33333333-3333-4333-8333-333333333333",
        style: "swing",
      }).success,
    ).toBe(true);
    expect(
      setTradeStyleSchema.safeParse({
        tradeId: "33333333-3333-4333-8333-333333333333",
        style: "intraday",
      }).success,
    ).toBe(false);
  });
});
