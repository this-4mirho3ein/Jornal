import { describe, expect, it } from "vitest";

import {
  formatDateTimeShortInTz,
  formatRMultiple,
} from "@/lib/format";

describe("formatDateTimeShortInTz", () => {
  it("renders compact wall-clock in the target zone", () => {
    const date = new Date("2026-11-06T10:05:00.000Z");
    expect(formatDateTimeShortInTz(date, "UTC")).toBe("Nov 6, 10:05");
  });

  it("shifts with the timezone", () => {
    const date = new Date("2026-11-06T22:30:00.000Z");
    expect(formatDateTimeShortInTz(date, "Asia/Dubai")).toBe("Nov 7, 02:30");
  });

  it("falls back to — for invalid dates", () => {
    expect(formatDateTimeShortInTz("not-a-date", "UTC")).toBe("—");
  });
});

describe("formatRMultiple", () => {
  it("signs positives and leaves negatives/zero plain", () => {
    expect(formatRMultiple("1.85")).toBe("+1.85R");
    expect(formatRMultiple("-0.5000")).toBe("-0.50R");
    expect(formatRMultiple("0")).toBe("0.00R");
  });

  it("renders — for missing values", () => {
    expect(formatRMultiple(null)).toBe("—");
    expect(formatRMultiple("")).toBe("—");
    expect(formatRMultiple("garbage")).toBe("—");
  });
});
