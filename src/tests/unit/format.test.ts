import { describe, expect, it } from "vitest";

import { formatDuration, formatMoney, lastSeenLabel, maskLogin } from "@/lib/format";

describe("maskLogin (spec §8.1)", () => {
  it("masks all but the last four digits", () => {
    expect(maskLogin(51234567)).toBe("••••4567");
    expect(maskLogin("987654321")).toBe("••••4321");
  });

  it("handles short and missing logins", () => {
    expect(maskLogin(42)).toBe("••••42");
    expect(maskLogin(null)).toBeNull();
    expect(maskLogin(undefined)).toBeNull();
    expect(maskLogin("")).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats numeric strings as currency (no floats stored)", () => {
    expect(formatMoney("1234.56")).toBe("$1,234.56");
    expect(formatMoney("1234.56", { currency: "EUR" })).toBe("€1,234.56");
  });

  it("is dash-safe for nullish/invalid input", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("")).toBe("—");
    expect(formatMoney("not-a-number")).toBe("—");
  });

  it("signs P&L explicitly and uses a true minus", () => {
    expect(formatMoney("150.00", { signed: true })).toBe("+$150.00");
    expect(formatMoney("-40.50", { signed: true })).toBe("−$40.50");
    expect(formatMoney("-40.50")).toBe("−$40.50");
  });

  it("falls back to a plain number for non-ISO currency codes", () => {
    const result = formatMoney("10", { currency: "CT" });
    expect(result).toMatch(/10/);
    expect(result).toContain("CT");
  });
});

describe("lastSeenLabel / formatDuration", () => {
  const now = new Date("2026-11-06T12:00:00Z");

  it("labels recency, never-seen, and ISO strings", () => {
    expect(lastSeenLabel(null, now)).toBe("never");
    expect(lastSeenLabel(new Date(now.getTime() - 10_000), now)).toBe("just now");
    expect(lastSeenLabel("2026-11-06T11:30:00Z", now)).toMatch(/ago$/);
  });

  it("formats durations compactly", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(5400)).toBe("1h 30m");
    expect(formatDuration(3 * 86_400 + 2 * 3600)).toBe("3d 2h");
    expect(formatDuration(null)).toBe("—");
  });
});
