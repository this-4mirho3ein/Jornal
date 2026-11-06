import { describe, expect, it } from "vitest";

import {
  assignStrategy,
  parseStrategyCode,
  type StrategyRef,
} from "@/lib/ingest/strategy-assignment";

const strategies: StrategyRef[] = [
  { id: "11111111-1111-4111-8111-111111111111", code: "ICT-SB" },
  { id: "22222222-2222-4222-8222-222222222222", code: "ICT-OB" },
  { id: "33333333-3333-4333-8333-333333333333", code: "MR" },
];

const magicMap = new Map<number, string>([[1001, strategies[0].id]]);

describe("parseStrategyCode (S:<code> comment marker)", () => {
  it("extracts the code, case-insensitively, with surrounding noise", () => {
    expect(parseStrategyCode("S:ICT-OB")).toBe("ICT-OB");
    expect(parseStrategyCode("s: ict-ob")).toBe("ict-ob");
    expect(parseStrategyCode("S: ICT-SB extra")).toBe("ICT-SB");
    expect(parseStrategyCode("breakout, S:MR; v2")).toBe("MR");
  });

  it("returns null when the marker is absent", () => {
    expect(parseStrategyCode("rsi divergence")).toBeNull();
    expect(parseStrategyCode("")).toBeNull();
    expect(parseStrategyCode(null)).toBeNull();
  });
});

describe("assignStrategy (§5.1.7 — magic map first, then comment)", () => {
  it("assigns by magic number when mapped", () => {
    const result = assignStrategy({ magic: 1001, comment: "S:ICT-OB", magicMap, strategies });
    expect(result).toEqual({ strategyId: strategies[0].id, source: "magic" });
  });

  it("falls back to the comment code", () => {
    const result = assignStrategy({ magic: 9999, comment: "S:ict-ob", magicMap, strategies });
    expect(result).toEqual({ strategyId: strategies[1].id, source: "comment" });
  });

  it("returns none when neither matches", () => {
    const result = assignStrategy({ magic: 9999, comment: "random note", magicMap, strategies });
    expect(result).toEqual({ strategyId: null, source: "none" });
  });

  it("handles missing comment / empty map", () => {
    const result = assignStrategy({ magic: null, comment: null, magicMap: new Map(), strategies });
    expect(result).toEqual({ strategyId: null, source: "none" });
  });
});
