import { X } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  omitFilter,
  SORT_LABELS,
  STYLE_LABELS,
  tradesFiltersToQuery,
  type TradeFilterKey,
  type TradesFilters,
} from "@/features/trades/schemas";

type MultiKey = "symbols" | "strategies" | "styles" | "setups" | "mistakes";

interface ChipDef {
  key: TradeFilterKey;
  label: string;
  /** Raw value for multi-value chips — removing drops only this entry. */
  value?: string;
}

function removeOne(
  filters: TradesFilters,
  key: MultiKey,
  value: string,
): string {
  const next: TradesFilters = { ...filters, page: 1 };
  if (key === "symbols") {
    next.symbols = filters.symbols?.filter((v) => v !== value);
  } else if (key === "strategies") {
    next.strategies = filters.strategies?.filter((v) => v !== value);
  } else if (key === "styles") {
    next.styles = filters.styles?.filter((v) => v !== value);
  } else if (key === "setups") {
    next.setups = filters.setups?.filter((v) => v !== value);
  } else {
    next.mistakes = filters.mistakes?.filter((v) => v !== value);
  }
  const qs = tradesFiltersToQuery(next);
  return qs ? `/trades?${qs}` : "/trades";
}

/**
 * Removable chips for every active filter (spec §11). Each chip links to the
 * same view minus that one filter; multi-value chips remove a single entry.
 * Links — not state — so chips stay shareable and back-button friendly.
 */
export function FilterChips({
  filters,
  accountLabel,
  strategyLabels,
}: {
  filters: TradesFilters;
  accountLabel: string | null;
  strategyLabels: Map<string, string>;
}) {
  const chips: ChipDef[] = [];
  if (filters.account && accountLabel) {
    chips.push({ key: "account", label: accountLabel });
  }
  for (const symbol of filters.symbols ?? []) {
    chips.push({ key: "symbols", label: symbol, value: symbol });
  }
  if (filters.direction) {
    chips.push({
      key: "direction",
      label: filters.direction === "buy" ? "Buy" : "Sell",
    });
  }
  if (filters.status) {
    chips.push({
      key: "status",
      label: filters.status === "open" ? "Open" : "Closed",
    });
  }
  if (filters.result) {
    chips.push({
      key: "result",
      label:
        filters.result === "win"
          ? "Win"
          : filters.result === "loss"
            ? "Loss"
            : "Breakeven",
    });
  }
  for (const id of filters.strategies ?? []) {
    chips.push({
      key: "strategies",
      label: strategyLabels.get(id) ?? "Strategy",
      value: id,
    });
  }
  for (const style of filters.styles ?? []) {
    chips.push({
      key: "styles",
      label: STYLE_LABELS[style],
      value: style,
    });
  }
  for (const tag of filters.setups ?? []) {
    chips.push({ key: "setups", label: `setup: ${tag}`, value: tag });
  }
  for (const tag of filters.mistakes ?? []) {
    chips.push({ key: "mistakes", label: `mistake: ${tag}`, value: tag });
  }
  if (filters.plMin) {
    chips.push({ key: "plMin", label: `P/L ≥ ${filters.plMin}` });
  }
  if (filters.plMax) {
    chips.push({ key: "plMax", label: `P/L ≤ ${filters.plMax}` });
  }
  if (filters.rMin) chips.push({ key: "rMin", label: `R ≥ ${filters.rMin}` });
  if (filters.rMax) chips.push({ key: "rMax", label: `R ≤ ${filters.rMax}` });
  if (filters.rating) {
    chips.push({ key: "rating", label: `★ ${filters.rating}+` });
  }
  if (filters.from) {
    chips.push({ key: "from", label: `from ${filters.from}` });
  }
  if (filters.to) chips.push({ key: "to", label: `to ${filters.to}` });
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”` });
  if (filters.sort !== "opened_desc") {
    chips.push({ key: "sort", label: SORT_LABELS[filters.sort] });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip, index) => {
        const target =
          chip.value !== undefined
            ? removeOne(filters, chip.key as MultiKey, chip.value)
            : (() => {
                const qs = tradesFiltersToQuery(omitFilter(filters, chip.key));
                return qs ? `/trades?${qs}` : "/trades";
              })();
        return (
          <Link
            key={`${chip.key}-${index}`}
            href={target}
            scroll={false}
            aria-label={`Remove filter ${chip.label}`}
            className="group"
          >
            <Badge
              variant="outline"
              className={cn(
                "gap-1 pr-1 font-normal text-muted-foreground transition-colors",
                "group-hover:border-foreground/30 group-hover:text-foreground",
              )}
            >
              {chip.label}
              <X
                className="size-3 opacity-60 group-hover:opacity-100"
                aria-hidden="true"
              />
            </Badge>
          </Link>
        );
      })}
      <Link
        href="/trades"
        scroll={false}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Clear all
      </Link>
    </div>
  );
}
