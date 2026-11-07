import { describe, expect, it } from "vitest";

import { tradesToCsv } from "@/features/trades/csv";
import type { TradeListRow } from "@/features/trades/queries";

function row(overrides: Partial<TradeListRow> = {}): TradeListRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    positionId: 777_009_123,
    symbol: "XAUUSD",
    direction: "buy",
    status: "closed",
    openedAt: new Date("2026-11-06T10:00:00.000Z"),
    closedAt: new Date("2026-11-06T11:30:00.000Z"),
    volumeOpened: "0.10",
    volumeClosed: "0.10",
    avgEntryPrice: "2650.24000",
    avgExitPrice: "2653.91000",
    grossProfit: "39.20",
    commission: "-0.60",
    swap: "0.00",
    fee: "0.00",
    netProfit: "38.60",
    rMultiple: "1.8500",
    durationSeconds: 5400,
    strategyId: null,
    strategyName: "ICT Silver Bullet",
    strategyColor: null,
    style: "scalp",
    styleSource: "auto",
    rating: null,
    mt5Magic: 1001,
    mt5Comment: "S:ICT-SB",
    notes: null,
    accountName: "Alpari Demo",
    accountTimezone: "UTC",
    ...overrides,
  };
}

describe("tradesToCsv", () => {
  it("writes the documented header order", () => {
    const csv = tradesToCsv([]);
    const header = csv.split("\r\n")[0];
    expect(header.startsWith("position_id,account,symbol,direction,status")).toBe(
      true,
    );
    expect(header.endsWith("notes,rating")).toBe(true);
  });

  it("maps raw numeric strings without reformatting", () => {
    const line = tradesToCsv([row()]).split("\r\n")[1];
    expect(line).toContain("777009123");
    expect(line).toContain("38.60");
    expect(line).toContain("2650.24000");
    expect(line).toContain("1.8500");
    expect(line).toContain("S:ICT-SB");
  });

  it("escapes commas, quotes and newlines in text fields", () => {
    const escaped = tradesToCsv([
      row({
        strategyName: 'Fibo, "retest"',
        notes: "line one\nline two",
      }),
    ]);
    expect(escaped).toContain('"Fibo, ""retest"""');
    expect(escaped).toContain('"line one\nline two"');
  });

  it("emits empty cells for missing values", () => {
    const line = tradesToCsv([
      row({
        strategyName: null,
        notes: null,
        rating: null,
        rMultiple: null,
      }),
    ]);
    const cells = line.split("\r\n")[1]?.split(",") ?? [];
    // strategy (index 18), style_source present, notes (index 23), rating (24) empty
    expect(cells[18]).toBe("");
    expect(cells[23]).toBe("");
    expect(cells[24]).toBe("");
  });

  it("ends with a trailing CRLF", () => {
    expect(tradesToCsv([row()]).endsWith("\r\n")).toBe(true);
  });
});
