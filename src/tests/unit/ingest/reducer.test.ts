import { describe, expect, it } from "vitest";

import {
  computeTradePatch,
  deriveCashOpType,
  fillPriceOnce,
  isPriceUnset,
  type ReducerDeal,
  type TradePatch,
  type TradePatchInput,
} from "@/lib/ingest/reducer";

const T0 = Date.parse("2026-03-10T09:30:00Z");

function deal(overrides: Partial<ReducerDeal> & { timeAtSec: number }): ReducerDeal {
  const { timeAtSec, ...rest } = overrides;
  return {
    entry: "in",
    price: "2320.50",
    volume: "0.10",
    profit: "0",
    commission: "0",
    swap: "0",
    fee: "0",
    timeUtc: new Date(T0 + timeAtSec * 1000),
    reason: "client",
    ...rest,
  };
}

function baseInput(overrides: Partial<TradePatchInput> = {}): TradePatchInput {
  return {
    direction: "buy",
    deals: [],
    currentInitialSl: null,
    currentInitialTp: null,
    currentSl: null,
    currentTp: null,
    incomingSl: null,
    incomingTp: null,
    tickValue: null,
    tickSize: null,
    styleSource: "auto",
    currentStyle: null,
    ...overrides,
  };
}

/** open → tighten SL → partial close → final close (all 0.10 exit). */
const fullLifecycle: ReducerDeal[] = [
  deal({ timeAtSec: 0, entry: "in", price: "2320.50", volume: "0.10", commission: "-0.70" }),
  deal({ timeAtSec: 1500, entry: "out", price: "2325.10", volume: "0.04", profit: "17.20", commission: "-0.30" }),
  deal({ timeAtSec: 2400, entry: "out", price: "2331.00", volume: "0.06", profit: "23.30", commission: "-0.50", reason: "tp" }),
];

describe("computeTradePatch — full lifecycle (task 05 §7)", () => {
  it("aggregates from deals: volumes, weighted prices, signed pips", () => {
    const patch = computeTradePatch(baseInput({ deals: fullLifecycle, direction: "buy" }));
    expect(patch.volumeOpened).toBe("0.10");
    expect(patch.volumeClosed).toBe("0.10");
    expect(patch.avgEntryPrice).toBe("2320.50000");
    // (0.04×2325.1 + 0.06×2331) / 0.10 = 2328.64
    expect(patch.avgExitPrice).toBe("2328.64000");
    expect(patch.pipsOrPoints).toBe("8.14000");
  });

  it("sets close state: closed_at, duration, close_reason, signed nets", () => {
    const patch = computeTradePatch(baseInput({ deals: fullLifecycle, direction: "buy" }));
    expect(patch.status).toBe("closed");
    expect(patch.openedAt?.toISOString()).toBe("2026-03-10T09:30:00.000Z");
    expect(patch.closedAt?.toISOString()).toBe("2026-03-10T10:10:00.000Z");
    expect(patch.durationSeconds).toBe(2400);
    expect(patch.closeReason).toBe("tp");
    expect(patch.grossProfit).toBe("40.50");
    expect(patch.commission).toBe("-1.50");
    expect(patch.netProfit).toBe("39.00");
  });

  it("classifies style on close (§9 edges)", () => {
    const run = (deals: ReducerDeal[], overrides: Partial<TradePatchInput> = {}) =>
      computeTradePatch(baseInput({ deals, direction: "buy", ...overrides }));

    // 14m59s → scalp; 15m01s same UTC day → day
    const scalp = run([deal({ timeAtSec: 0, volume: "0.10" }), deal({ timeAtSec: 899, entry: "out", volume: "0.10", profit: "1" })]);
    const dayEdge = run([deal({ timeAtSec: 0, volume: "0.10" }), deal({ timeAtSec: 901, entry: "out", volume: "0.10", profit: "1" })]);
    expect(scalp.style).toBe("scalp");
    expect(dayEdge.style).toBe("day");

    // overnight 25h → swing (no same-day), 15 days → position
    const swing = run([deal({ timeAtSec: 0, volume: "0.10" }), deal({ timeAtSec: 25 * 3600, entry: "out", volume: "0.10", profit: "1" })]);
    const position = run([deal({ timeAtSec: 0, volume: "0.10" }), deal({ timeAtSec: 15 * 86400, entry: "out", volume: "0.10", profit: "1" })]);
    expect(swing.style).toBe("swing");
    expect(position.style).toBe("position");

    // manual style source is preserved on close
    const manual = run(
      [deal({ timeAtSec: 0, volume: "0.10" }), deal({ timeAtSec: 1, entry: "out", volume: "0.10", profit: "9" })],
      { styleSource: "manual", currentStyle: "swing" },
    );
    expect(manual.style).toBe("swing");
  });

  it("keeps the trade open while volume remains (partial close)", () => {
    const patch = computeTradePatch(baseInput({ deals: fullLifecycle.slice(0, 2), direction: "buy" }));
    expect(patch.status).toBe("open");
    expect(patch.closedAt).toBeNull();
    expect(patch.closeReason).toBeNull();
    expect(patch.volumeClosed).toBe("0.04");
  });
});

describe("computeTradePatch — order/transform invariants (§19)", () => {
  it("is deterministic — same deals recomputed give an identical patch (duplicate safety)", () => {
    const buildInput = (): TradePatchInput =>
      baseInput({
        deals: fullLifecycle.map((d) => ({ ...d, timeUtc: new Date(d.timeUtc.getTime()) })),
        direction: "buy",
      });
    const first = JSON.parse(JSON.stringify(computeTradePatch(buildInput()))) as TradePatch;
    const second = JSON.parse(JSON.stringify(computeTradePatch(buildInput()))) as TradePatch;
    expect(second).toEqual(first);
  });

  it("heals close-before-open delivery order (§5.1.7 out-of-order)", () => {
    // Exit deal delivered first (retry queue) — entry time is still 1000s later.
    const outFirst = [
      deal({ timeAtSec: 3000, entry: "out", volume: "0.10", profit: "12.50", reason: "sl" }),
    ];
    const stubOnly = computeTradePatch(baseInput({ deals: outFirst, direction: "buy" }));
    expect(stubOnly.status).toBe("open"); // no entry volume yet
    expect(stubOnly.openedAt?.toISOString()).toBe("2026-03-10T10:20:00.000Z");

    // …then the entry deal arrives; openedAt is recomputed from entry deals.
    const healed = computeTradePatch(
      baseInput({
        deals: [...outFirst, deal({ timeAtSec: 1000, volume: "0.10", price: "2321.00" })],
        direction: "buy",
      }),
    );
    expect(healed.status).toBe("closed");
    expect(healed.openedAt?.toISOString()).toBe("2026-03-10T09:46:40.000Z");
    expect(healed.closedAt?.toISOString()).toBe("2026-03-10T10:20:00.000Z");
    expect(healed.durationSeconds).toBe(2000);
    expect(healed.closeReason).toBe("sl");
    expect(healed.netProfit).toBe("12.50");
  });

  it("never overwrites initial_sl/tp once set (§4.1)", () => {
    const first = computeTradePatch(
      baseInput({ deals: fullLifecycle, direction: "buy", incomingSl: "2310.50000", incomingTp: "2350.00000" }),
    );
    expect(first.initialSl).toBe("2310.50000");
    expect(first.initialTp).toBe("2350.00000");

    // Later event tries a different SL — initial stays; live sl follows.
    const later = computeTradePatch(
      baseInput({
        deals: fullLifecycle,
        direction: "buy",
        currentInitialSl: first.initialSl,
        currentInitialTp: first.initialTp,
        currentSl: first.sl,
        currentTp: first.tp,
        incomingSl: "2312.00000",
      }),
    );
    expect(later.initialSl).toBe("2310.50000");
    expect(later.sl).toBe("2312.00000");
  });
});

describe("risk / r_multiple / stops helpers (§10)", () => {
  it("computes risk and R only when tick values are known", () => {
    const withTicks = computeTradePatch(
      baseInput({
        deals: fullLifecycle,
        direction: "buy",
        incomingSl: "2310.50000",
        tickValue: 1,
        tickSize: 0.01,
      }),
    );
    // |2320.5 − 2310.5| / 0.01 × 1 × 0.10 = 100.00 ; R = 39.00/100.00 = 0.39
    expect(withTicks.riskAmount).toBe("100.00");
    expect(withTicks.rMultiple).toBe("0.3900");

    const withoutTicks = computeTradePatch(baseInput({ deals: fullLifecycle, direction: "buy", incomingSl: "2310.50000" }));
    expect(withoutTicks.riskAmount).toBeNull();
    expect(withoutTicks.rMultiple).toBeNull();

    const noSl = computeTradePatch(
      baseInput({ deals: fullLifecycle, direction: "buy", tickValue: 1, tickSize: 0.01 }),
    );
    expect(noSl.riskAmount).toBeNull();
    expect(noSl.initialSl).toBeNull();
  });

  it("fill semantics: null/0 count as unset", () => {
    expect(isPriceUnset(null)).toBe(true);
    expect(isPriceUnset("0")).toBe(true);
    expect(isPriceUnset("2310.50000")).toBe(false);
    expect(fillPriceOnce(null, "2310.50000")).toBe("2310.50000");
    expect(fillPriceOnce("2311.00000", "2310.50000")).toBe("2311.00000");
    expect(fillPriceOnce(null, null)).toBeNull();
  });

  it("derives cash operation type from the amount sign", () => {
    expect(deriveCashOpType(250)).toBe("deposit");
    expect(deriveCashOpType("0")).toBe("deposit");
    expect(deriveCashOpType("-50.50")).toBe("withdrawal");
  });
});
