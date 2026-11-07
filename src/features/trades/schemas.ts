import { z } from "zod";

/**
 * Trades-list filters (spec §11). Each entry parses ONE url param value;
 * values validate independently so a crafted URL can never break the page —
 * invalid values are simply dropped. The canonical serialization lives in
 * `tradesFiltersToQuery`, used by chips, pagination and CSV export links.
 */

const STYLE_VALUES = ["scalp", "day", "swing", "position"] as const;
export type TradeStyleFilter = (typeof STYLE_VALUES)[number];

export const STYLE_LABELS: Record<TradeStyleFilter, string> = {
  scalp: "Scalp",
  day: "Day",
  swing: "Swing",
  position: "Position",
};

export const SORTS = [
  "opened_desc",
  "opened_asc",
  "closed_desc",
  "pnl_desc",
  "pnl_asc",
  "r_desc",
] as const;
export type TradeSort = (typeof SORTS)[number];
export const DEFAULT_SORT: TradeSort = "opened_desc";

export const SORT_LABELS: Record<TradeSort, string> = {
  opened_desc: "Newest first",
  opened_asc: "Oldest first",
  closed_desc: "Recently closed",
  pnl_desc: "P/L high → low",
  pnl_asc: "P/L low → high",
  r_desc: "Best R first",
};

const csvList = z
  .string()
  .transform((s) => [
    ...new Set(
      s
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ]);

const decimalString = z.string().regex(/^-?\d{1,12}(\.\d{1,5})?$/);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const tradeFilterSchemas = {
  account: z.uuid(),
  symbols: csvList.pipe(z.array(z.string().min(1).max(20)).max(20)),
  direction: z.enum(["buy", "sell"]),
  status: z.enum(["open", "closed"]),
  result: z.enum(["win", "loss", "be"]),
  strategies: csvList.pipe(z.array(z.uuid()).max(50)),
  styles: csvList.pipe(z.array(z.enum(STYLE_VALUES)).max(4)),
  setups: csvList.pipe(z.array(z.string().min(1).max(40)).max(30)),
  mistakes: csvList.pipe(z.array(z.string().min(1).max(40)).max(30)),
  plMin: decimalString,
  plMax: decimalString,
  rMin: decimalString,
  rMax: decimalString,
  rating: z
    .string()
    .regex(/^[1-5]$/)
    .transform(Number),
  from: isoDay,
  to: isoDay,
  q: z
    .string()
    .transform((s) => s.trim().slice(0, 60))
    .pipe(z.string().min(1)),
  sort: z.enum(SORTS),
  page: z
    .string()
    .regex(/^\d{1,4}$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(999)),
} as const;

export type TradeFilterKey = keyof typeof tradeFilterSchemas;

export interface TradesFilters {
  account?: string;
  symbols?: string[];
  direction?: "buy" | "sell";
  status?: "open" | "closed";
  result?: "win" | "loss" | "be";
  strategies?: string[];
  styles?: TradeStyleFilter[];
  setups?: string[];
  mistakes?: string[];
  plMin?: string;
  plMax?: string;
  rMin?: string;
  rMax?: string;
  /** Minimum star rating (1–5). */
  rating?: number;
  /** ISO day (YYYY-MM-DD), inclusive, on openedAt (UTC calendar day). */
  from?: string;
  to?: string;
  q?: string;
  sort: TradeSort;
  page: number;
}

/**
 * Parse raw Next searchParams into `TradesFilters`. Repeated params
 * (`symbols=X&symbols=Y`) join into the single csv convention.
 */
export function parseTradesFilters(
  input: Record<string, string | string[] | undefined>,
): TradesFilters {
  const out: TradesFilters = { sort: DEFAULT_SORT, page: 1 };
  for (const key of Object.keys(tradeFilterSchemas) as TradeFilterKey[]) {
    const raw = input[key];
    if (raw === undefined) continue;
    const value = Array.isArray(raw) ? raw.join(",") : raw;
    if (typeof value !== "string") continue;
    if (value.length === 0 || value.length > 400) continue;
    const parsed = tradeFilterSchemas[key].safeParse(value);
    if (!parsed.success) continue;
    switch (key) {
      case "account":
        out.account = parsed.data as string;
        break;
      case "symbols":
        out.symbols = parsed.data as string[];
        break;
      case "direction":
        out.direction = parsed.data as "buy" | "sell";
        break;
      case "status":
        out.status = parsed.data as "open" | "closed";
        break;
      case "result":
        out.result = parsed.data as "win" | "loss" | "be";
        break;
      case "strategies":
        out.strategies = parsed.data as string[];
        break;
      case "styles":
        out.styles = parsed.data as TradeStyleFilter[];
        break;
      case "setups":
        out.setups = parsed.data as string[];
        break;
      case "mistakes":
        out.mistakes = parsed.data as string[];
        break;
      case "plMin":
        out.plMin = parsed.data as string;
        break;
      case "plMax":
        out.plMax = parsed.data as string;
        break;
      case "rMin":
        out.rMin = parsed.data as string;
        break;
      case "rMax":
        out.rMax = parsed.data as string;
        break;
      case "rating":
        out.rating = parsed.data as number;
        break;
      case "from":
        out.from = parsed.data as string;
        break;
      case "to":
        out.to = parsed.data as string;
        break;
      case "q":
        out.q = parsed.data as string;
        break;
      case "sort":
        out.sort = parsed.data as TradeSort;
        break;
      case "page":
        out.page = parsed.data as number;
        break;
    }
  }
  return out;
}

/** Canonical URL serialization — omits defaults so clean URLs stay clean. */
export function tradesFiltersToQuery(f: TradesFilters): string {
  const p = new URLSearchParams();
  if (f.account) p.set("account", f.account);
  if (f.symbols?.length) p.set("symbols", f.symbols.join(","));
  if (f.direction) p.set("direction", f.direction);
  if (f.status) p.set("status", f.status);
  if (f.result) p.set("result", f.result);
  if (f.strategies?.length) p.set("strategies", f.strategies.join(","));
  if (f.styles?.length) p.set("styles", f.styles.join(","));
  if (f.setups?.length) p.set("setups", f.setups.join(","));
  if (f.mistakes?.length) p.set("mistakes", f.mistakes.join(","));
  if (f.plMin) p.set("plMin", f.plMin);
  if (f.plMax) p.set("plMax", f.plMax);
  if (f.rMin) p.set("rMin", f.rMin);
  if (f.rMax) p.set("rMax", f.rMax);
  if (f.rating) p.set("rating", String(f.rating));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.q) p.set("q", f.q);
  if (f.sort !== DEFAULT_SORT) p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  // Commas are legal query chars — keep them literal for readable share URLs.
  return p.toString().replaceAll("%2C", ",");
}

/** Drop one filter key (or everything) and reset to page 1 — powers chips. */
export function omitFilter(
  f: TradesFilters,
  key: TradeFilterKey | "all",
): TradesFilters {
  if (key === "all") return { sort: f.sort, page: 1 };
  const next: TradesFilters = { ...f, page: 1 };
  switch (key) {
    case "sort":
      next.sort = DEFAULT_SORT;
      break;
    case "page":
      next.page = 1;
      break;
    default: {
      const mutable = next as unknown as Record<string, unknown>;
      // Symbols/tags drop one entry at a time in the chips component instead.
      delete mutable[key];
    }
  }
  return next;
}

/** Number of non-default filters shown in "Filters (n)" badges. */
export function countActiveFilters(f: TradesFilters): number {
  let n = 0;
  if (f.account) n++;
  if (f.symbols?.length) n++;
  if (f.direction) n++;
  if (f.status) n++;
  if (f.result) n++;
  if (f.strategies?.length) n++;
  if (f.styles?.length) n++;
  if (f.setups?.length) n++;
  if (f.mistakes?.length) n++;
  if (f.plMin) n++;
  if (f.plMax) n++;
  if (f.rMin) n++;
  if (f.rMax) n++;
  if (f.rating) n++;
  if (f.from) n++;
  if (f.to) n++;
  if (f.q) n++;
  if (f.sort !== DEFAULT_SORT) n++;
  return n;
}
