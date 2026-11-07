import { describe, expect, it } from "vitest";

import {
  computeKpis,
  computeStreaks,
  expectancyR,
  maxDrawdown,
  parseDashboardPeriod,
  periodStartIso,
  type TradeLite,
} from "@/lib/metrics";

const t = (net: string, r: string | null = null): TradeLite => ({ netProfit: net, rMultiple: r });

describe("computeKpis", () => {
  it("computes the classic fixture set with Decimal sums", () => {
    const k = computeKpis([t("100", "2"), t("-50", "-1"), t("30", "0.6"), t("0", null)]);
    expect(k.wins).toBe(2);
    expect(k.losses).toBe(1);
    expect(k.breakeven).toBe(1);
    expect(k.net).toBe("80.00");
    expect(k.grossProfit).toBe("130.00");
    expect(k.grossLoss).toBe("-50.00");
    expect(k.winRate).toBe(66.7);
    expect(k.profitFactor).toBe(2.6);
    expect(k.avgWin).toBe("65.00");
    expect(k.avgLoss).toBe("-50.00");
    expect(k.payoff).toBe(1.3);
    expect(k.best).toBe("100.00");
    expect(k.worst).toBe("-50.00");
  });

  it("returns nulls instead of fake numbers on empty/undecided sets", () => {
    const empty = computeKpis([]);
    expect(empty.net).toBe("0.00");
    expect(empty.winRate).toBeNull();
    expect(empty.profitFactor).toBeNull();
    const onlyBe = computeKpis([t("0")]);
    expect(onlyBe.winRate).toBeNull();
    expect(onlyBe.breakeven).toBe(1);
  });
});

describe("maxDrawdown", () => {
  it("finds the classic peak-to-trough case", () => {
    const dd = maxDrawdown([
      { value: "1000" },
      { value: "1200" },
      { value: "900" },
      { value: "1100" },
    ]);
    expect(dd.absolute).toBe("300.00");
    expect(dd.percent).toBe(25);
  });

  it("is zero for a monotonic equity rise", () => {
    const dd = maxDrawdown([{ value: "1" }, { value: "2" }, { value: "10" }]);
    expect(dd.absolute).toBe("0.00");
    expect(dd.percent).toBe(0);
  });
});

describe("computeStreaks", () => {
  it("tracks longest runs and the current one", () => {
    const streaks = computeStreaks([t("10"), t("10"), t("-5"), t("-5"), t("-5"), t("2")]);
    expect(streaks.longestWin).toBe(2);
    expect(streaks.longestLoss).toBe(3);
    expect(streaks.current).toBe(1);
  });

  it("treats breakeven as pass-through", () => {
    const streaks = computeStreaks([t("10"), t("0"), t("10")]);
    expect(streaks.longestWin).toBe(2);
    expect(streaks.current).toBe(2);
  });
});

describe("expectancyR", () => {
  it("averages known R only", () => {
    expect(expectancyR([t("1", "2"), t("-1", "-1"), t("5", null)])).toBe(0.5);
    expect(expectancyR([t("5", null)])).toBeNull();
  });
});

describe("period helpers", () => {
  it("parses the period param with 30d default", () => {
    expect(parseDashboardPeriod(undefined)).toBe("30d");
    expect(parseDashboardPeriod(["ytd"])).toBe("ytd");
    expect(parseDashboardPeriod("nonsense")).toBe("30d");
  });

  it("maps periods to ISO starts (ytd = Jan 1 UTC)", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    expect(periodStartIso("ytd", now)).toBe("2026-01-01T00:00:00.000Z");
    expect(periodStartIso("7d", now)).toBe("2026-10-31T12:00:00.000Z");
    expect(periodStartIso("all", now)).toBeNull();
  });
});
