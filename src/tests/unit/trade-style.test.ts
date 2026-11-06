import { describe, expect, it } from "vitest";
import { classifyStyle, isSameTradingDay } from "@/lib/trade-style";

function ms(minutes: number): number {
  return minutes * 60;
}

describe("classifyStyle (spec §9)", () => {
  it("classifies scalps under 15 minutes", () => {
    expect(
      classifyStyle({ durationSeconds: ms(14.99), closedSameTradingDay: true }),
    ).toBe("scalp");
    expect(classifyStyle({ durationSeconds: ms(0), closedSameTradingDay: true })).toBe(
      "scalp",
    );
  });

  it("classifies day trades between 15 minutes and same-day close", () => {
    expect(classifyStyle({ durationSeconds: ms(15), closedSameTradingDay: true })).toBe(
      "day",
    );
    expect(
      classifyStyle({ durationSeconds: ms(6 * 60), closedSameTradingDay: true }),
    ).toBe("day");
    expect(
      classifyStyle({ durationSeconds: ms(24 * 60) - 1, closedSameTradingDay: true }),
    ).toBe("day");
  });

  it("classifies overnight same-length holds as swing (no gap)", () => {
    expect(
      classifyStyle({ durationSeconds: ms(8 * 60), closedSameTradingDay: false }),
    ).toBe("swing");
  });

  it("classifies swings up to two weeks regardless of same-day", () => {
    expect(
      classifyStyle({ durationSeconds: ms(24 * 60), closedSameTradingDay: false }),
    ).toBe("swing");
    expect(
      classifyStyle({ durationSeconds: ms(14 * 24 * 60), closedSameTradingDay: false }),
    ).toBe("swing");
    expect(
      classifyStyle({ durationSeconds: ms(3 * 24 * 60), closedSameTradingDay: true }),
    ).toBe("swing");
  });

  it("classifies positions beyond two weeks", () => {
    expect(
      classifyStyle({
        durationSeconds: ms(14 * 24 * 60) + 1,
        closedSameTradingDay: true,
      }),
    ).toBe("position");
    expect(
      classifyStyle({ durationSeconds: ms(60 * 24 * 60), closedSameTradingDay: false }),
    ).toBe("position");
  });

  it("respects custom thresholds", () => {
    const t = { scalpMinutes: 5, positionDays: 7 };
    expect(
      classifyStyle({
        durationSeconds: ms(10),
        closedSameTradingDay: true,
        thresholds: t,
      }),
    ).toBe("day");
    expect(
      classifyStyle({
        durationSeconds: ms(7 * 24 * 60) + 1,
        closedSameTradingDay: false,
        thresholds: t,
      }),
    ).toBe("position");
  });

  it("returns null for invalid durations", () => {
    expect(
      classifyStyle({ durationSeconds: Number.NaN, closedSameTradingDay: true }),
    ).toBeNull();
    expect(
      classifyStyle({ durationSeconds: -5, closedSameTradingDay: true }),
    ).toBeNull();
  });
});

describe("isSameTradingDay", () => {
  it("detects same UTC day", () => {
    const open = new Date("2025-01-15T22:00:00Z");
    const close = new Date("2025-01-15T23:30:00Z");
    expect(isSameTradingDay(open, close)).toBe(true);
  });

  it("detects overnight rollover", () => {
    const open = new Date("2025-01-15T22:00:00Z");
    const close = new Date("2025-01-16T02:00:00Z");
    expect(isSameTradingDay(open, close)).toBe(false);
    // With UTC+3 broker offset the close is still the same trading day
    expect(isSameTradingDay(open, close, 180)).toBe(true);
  });
});
