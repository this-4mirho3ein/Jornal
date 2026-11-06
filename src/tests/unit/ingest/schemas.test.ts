/**
 * Ingest wire-contract tests (spec §4.2 / task 06).
 *
 * These guard against "poison events": payloads the concrete MT5 EA
 * (mt5/JournalSync.mq5) actually emits must validate, otherwise the EA
 * drops them as 4xx poison and the journal silently loses trades.
 * Pin two known-tricky shapes:
 *   - fully-closed positions arrive with `position.volume: 0` (§6
 *     BuildClosedPositionJson);
 *   - balance/cash operations have DEAL_ORDER = 0, so the EA omits
 *     `orderId` (the schema requires it positive *when present*).
 */
import { describe, expect, it } from "vitest";

import { ingestEventSchema } from "@/lib/ingest/schemas";

const t0 = 1_780_000_000;

const account = {
  login: 51234567,
  server: "ICMarketsSC-MT5",
  company: "Raw Trading Ltd",
  currency: "USD",
  leverage: 500,
  balance: 102500,
  equity: 102535.5,
  margin: 232.5,
  freeMargin: 102300,
  marginLevel: 4400.3,
  isDemo: false,
};

function baseEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    eventId: "deal:123456789",
    type: "deal_close",
    sentAtUtc: t0,
    account,
    position: {
      positionId: 987654321,
      symbol: "xauusd", // arrives lowercase from some paths — must normalize
      direction: "buy",
      magic: 1001,
      comment: "S:ICT-SB",
      volume: 0,
      sl: 2310.5,
      tp: 2340,
      tickValue: 1,
      tickSize: 0.01,
    },
    deal: {
      dealId: 123456789,
      orderId: 555,
      entry: "out",
      price: 2321.35,
      volume: 0.1,
      profit: 42.1,
      commission: -0.7,
      swap: 0,
      fee: 0,
      timeUtc: t0 - 10,
      reason: "tp",
    },
    ...overrides,
  };
}

describe("ingest wire contract — events the EA emits must validate", () => {
  it("accepts a fully-closed position with volume 0 (§6 BuildClosedPositionJson)", () => {
    expect(ingestEventSchema.safeParse(baseEvent()).success).toBe(true);
  });

  it("omitting orderId validates (balance ops have DEAL_ORDER = 0 → EA omits it)", () => {
    const cashOp = baseEvent({
      type: "cash_op",
      eventId: "deal:990000001",
      position: undefined,
      deal: {
        dealId: 990000001,
        entry: "in",
        price: 0,
        volume: 0,
        profit: -250,
        commission: 0,
        swap: 0,
        fee: 0,
        timeUtc: t0,
        reason: "other",
      },
    });
    expect(ingestEventSchema.safeParse(cashOp).success).toBe(true);
  });

  it("orderId 0 is rejected when present — the EA must omit, not zero it", () => {
    const bad = baseEvent({ deal: { dealId: 123456789, orderId: 0, entry: "out", price: 2321.35, volume: 0.1, profit: 42.1, commission: -0.7, swap: 0, fee: 0, timeUtc: t0 - 10 } });
    expect(ingestEventSchema.safeParse(bad).success).toBe(false);
  });

  it("normalizes symbol to uppercase and coerces numerics sent as strings", () => {
    const parsed = ingestEventSchema.parse(
      baseEvent({
        position: { positionId: 987654321, symbol: "xauusd", direction: "buy", volume: "0", sl: "0", tp: "0" },
      }),
    );
    expect(parsed.position?.symbol).toBe("XAUUSD");
    expect(parsed.position?.volume).toBe(0);
  });

  it("unknown schemaVersion is 422-rejected (EA / server version skew stays loud)", () => {
    expect(ingestEventSchema.safeParse(baseEvent({ schemaVersion: 2 })).success).toBe(false);
  });

  it("position_modify with a deal is rejected (EA never bundles them)", () => {
    const modify = baseEvent({ type: "position_modify", eventId: "mod:987654321:1000:1770000000", deal: baseEvent().deal as never });
    expect(ingestEventSchema.safeParse(modify).success).toBe(false);
  });

  it("heartbeat carries account only", () => {
    const hb = baseEvent({ type: "heartbeat", eventId: "hb:1780000000", position: undefined, deal: undefined });
    expect(ingestEventSchema.safeParse(hb).success).toBe(true);
  });
});
