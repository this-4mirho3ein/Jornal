import { describe, expect, it } from "vitest";

import {
  countActiveFilters,
  omitFilter,
  parseTradesFilters,
  tradesFiltersToQuery,
} from "@/features/trades/schemas";

describe("parseTradesFilters", () => {
  it("parses csv lists and trims entries", () => {
    const f = parseTradesFilters({ symbols: " XAUUSD ,EURUSD ,,XAUUSD " });
    expect(f.symbols).toEqual(["XAUUSD", "EURUSD"]);
  });

  it("joins repeated params into the csv convention", () => {
    const f = parseTradesFilters({ styles: ["scalp", "swing"] });
    expect(f.styles).toEqual(["scalp", "swing"]);
  });

  it("applies defaults", () => {
    const f = parseTradesFilters({});
    expect(f.sort).toBe("opened_desc");
    expect(f.page).toBe(1);
  });

  it("drops invalid values field-by-field (crafted URLs never break)", () => {
    const f = parseTradesFilters({
      direction: "sideways",
      page: "0",
      rating: "9",
      plMin: "abc",
      from: "2026/01/01",
      strategies: "not-a-uuid",
      q: "gold",
    });
    expect(f.direction).toBeUndefined();
    expect(f.page).toBe(1);
    expect(f.rating).toBeUndefined();
    expect(f.plMin).toBeUndefined();
    expect(f.from).toBeUndefined();
    expect(f.strategies).toBeUndefined();
    expect(f.q).toBe("gold");
  });

  it("clamps extremes within the declared bounds", () => {
    expect(parseTradesFilters({ page: "999" }).page).toBe(999);
    expect(parseTradesFilters({ page: "10000" }).page).toBe(1);
    expect(parseTradesFilters({ rating: "5" }).rating).toBe(5);
  });

  it("accepts negative decimal P/L bounds", () => {
    const f = parseTradesFilters({ plMin: "-150.50" });
    expect(f.plMin).toBe("-150.50");
  });
});

describe("tradesFiltersToQuery", () => {
  it("omits defaults so clean URLs stay clean", () => {
    expect(tradesFiltersToQuery({ sort: "opened_desc", page: 1 })).toBe("");
  });

  it("round-trips through the parser", () => {
    const filters = parseTradesFilters({
      symbols: "XAUUSD,EURUSD",
      result: "win",
      styles: "swing",
      plMin: "-100",
      sort: "pnl_desc",
      page: "2",
    });
    const qs = tradesFiltersToQuery(filters);
    expect(qs).toBe(
      "symbols=XAUUSD,EURUSD&result=win&styles=swing&plMin=-100&sort=pnl_desc&page=2",
    );
    expect(parseTradesFilters(Object.fromEntries(new URLSearchParams(qs)))).toEqual(
      filters,
    );
  });
});

describe("omitFilter / countActiveFilters", () => {
  it("removes one key and resets the page", () => {
    const f = parseTradesFilters({ result: "win", page: "3" });
    const next = omitFilter(f, "result");
    expect(next.result).toBeUndefined();
    expect(next.page).toBe(1);
  });

  it("all resets everything but keeps sort", () => {
    const f = parseTradesFilters({ result: "win", sort: "r_desc" });
    const next = omitFilter(f, "all");
    expect(next.result).toBeUndefined();
    expect(next.sort).toBe("r_desc");
    expect(next.page).toBe(1);
  });

  it("counts active filters (sort counts only when non-default)", () => {
    const base = { sort: "opened_desc", page: 1 } as const;
    expect(countActiveFilters(base)).toBe(0);
    expect(countActiveFilters({ ...base, sort: "r_desc", result: "win" })).toBe(2);
  });
});
