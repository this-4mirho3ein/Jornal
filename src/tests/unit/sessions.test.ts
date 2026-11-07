import { describe, expect, it } from "vitest";

import { sessionLabelFor, sessionsForTime } from "@/lib/sessions";

function utc(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 10, 9, hour, minute)); // Monday, week-day
}

describe("sessionsForTime / sessionLabelFor", () => {
  it("handles the Sydney window wrapping midnight", () => {
    expect(sessionLabelFor(utc(22))).toBe("Sydney");
    expect(sessionLabelFor(utc(23, 59))).toBe("Sydney");
    expect(sessionLabelFor(utc(0))).toBe("Sydney + Tokyo");
    expect(sessionLabelFor(utc(5))).toBe("Sydney + Tokyo");
  });

  it("cuts sessions at their exclusive end", () => {
    expect(sessionLabelFor(utc(6))).toBe("Tokyo"); // Sydney closed
    expect(sessionLabelFor(utc(9))).toBe("London"); // Tokyo closed
    expect(sessionLabelFor(utc(17))).toBe("New York"); // London closed
    expect(sessionLabelFor(utc(22))).toBe("Sydney"); // New York closed
  });

  it("reports overlaps — London × New York is the famous one", () => {
    expect(sessionLabelFor(utc(14))).toBe("London + New York");
    expect(sessionLabelFor(utc(8, 30))).toBe("Tokyo + London");
    expect(sessionLabelFor(utc(20))).toBe("New York");
  });

  it("respects minutes, not just whole hours", () => {
    expect(sessionLabelFor(utc(7, 59))).toBe("Tokyo");
    expect(sessionLabelFor(utc(8))).toBe("Tokyo + London");
    expect(sessionsForTime(utc(12, 59)).map((s) => s.key)).toEqual(["london"]);
  });
});
