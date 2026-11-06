import { describe, expect, it } from "vitest";

import { connectionLevel } from "@/features/accounts/connection";

function minutesAgo(minutes: number, now: Date): Date {
  return new Date(now.getTime() - minutes * 60_000);
}

describe("connectionLevel (spec §8.1)", () => {
  const now = new Date("2026-11-06T12:00:00Z");

  it("is live under 3 minutes", () => {
    expect(connectionLevel(minutesAgo(0, now), now)).toBe("live");
    expect(connectionLevel(minutesAgo(2.99, now), now)).toBe("live");
    expect(connectionLevel(minutesAgo(3, now), now)).not.toBe("live"); // boundary
  });

  it("is delayed between 3 and 15 minutes", () => {
    expect(connectionLevel(minutesAgo(3, now), now)).toBe("delayed");
    expect(connectionLevel(minutesAgo(14.99, now), now)).toBe("delayed");
    expect(connectionLevel(minutesAgo(15, now), now)).not.toBe("delayed"); // boundary
  });

  it("is offline beyond 15 minutes", () => {
    expect(connectionLevel(minutesAgo(15, now), now)).toBe("offline");
    expect(connectionLevel(minutesAgo(24 * 60, now), now)).toBe("offline");
  });

  it("is offline when never seen, in the future clocks, and for ISO strings", () => {
    expect(connectionLevel(null, now)).toBe("offline");
    expect(connectionLevel(minutesAgo(-1, now), now)).toBe("live"); // skew tolerated
    expect(connectionLevel("2026-11-06T11:59:00.000Z", now)).toBe("live");
  });
});
