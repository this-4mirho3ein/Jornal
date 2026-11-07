/**
 * Strategy feature zod schemas (task 07 / spec §9, §4.3).
 *
 * The gaps that actually matter:
 *   - colors are strict hex or empty (chips render inline styles);
 *   - magic must cover MT5's int32 range INCLUDING 0 — magic 0 is what
 *     EA-less/manual positions carry on some brokers;
 *   - codes are NOT user input anymore (owner request, 2026-11): the schema
 *     neither carries nor validates them; the server derives them (code.ts).
 */
import { describe, expect, it } from "vitest";

import {
  createStrategySchema,
  setDefaultStrategySchema,
  setMagicMappingSchema,
  setTradeStyleSchema,
  updateStrategySchema,
} from "@/features/strategies/schemas";

const ID = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_ID = "22222222-2222-4222-8222-222222222222";

describe("createStrategySchema", () => {
  it("accepts a name-only strategy (code is derived server-side)", () => {
    const parsed = createStrategySchema.parse({ name: "  ICT OB  " });
    expect(parsed.name).toBe("ICT OB");
    expect("code" in parsed).toBe(false);
  });

  it("accepts empty color but rejects non-hex colors, lowercasing valid ones", () => {
    const ok = createStrategySchema.parse({ name: "X", color: "" });
    expect(ok.color).toBe("");
    const hex = createStrategySchema.parse({ name: "X", color: "#22C55E" });
    expect(hex.color).toBe("#22c55e");
    expect(createStrategySchema.safeParse({ name: "X", color: "red" }).success).toBe(
      false,
    );
  });

  it("rejects unknown default styles and empty names", () => {
    expect(
      createStrategySchema.safeParse({ name: "X", defaultStyle: "scalp" }).success,
    ).toBe(true);
    expect(
      createStrategySchema.safeParse({ name: "X", defaultStyle: "news" }).success,
    ).toBe(false);
    expect(createStrategySchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("updateStrategySchema", () => {
  it("requires a valid strategy id", () => {
    expect(
      updateStrategySchema.safeParse({ strategyId: "not-a-uuid", name: "X" }).success,
    ).toBe(false);
    expect(
      updateStrategySchema.safeParse({ strategyId: ID, name: "X" }).success,
    ).toBe(true);
  });
});

describe("setDefaultStrategySchema — per-account default (ADR 0009)", () => {
  it("accepts a strategy id and null (clear)", () => {
    expect(
      setDefaultStrategySchema.safeParse({ accountId: ACCOUNT_ID, strategyId: ID })
        .success,
    ).toBe(true);
    expect(
      setDefaultStrategySchema.safeParse({ accountId: ACCOUNT_ID, strategyId: null })
        .success,
    ).toBe(true);
  });

  it("rejects invalid account/strategy ids", () => {
    expect(
      setDefaultStrategySchema.safeParse({ accountId: "nope", strategyId: ID }).success,
    ).toBe(false);
    expect(
      setDefaultStrategySchema.safeParse({ accountId: ACCOUNT_ID, strategyId: "nope" })
        .success,
    ).toBe(false);
  });
});

describe("setMagicMappingSchema — MT5 magic is int32, 0 included", () => {
  const base = {
    accountId: ACCOUNT_ID,
    strategyId: ID,
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
