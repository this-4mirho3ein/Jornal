import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { TradesFilters } from "@/features/trades/schemas";
import { tradesFiltersToQuery } from "@/features/trades/schemas";

/** Prev/next pagination preserving every filter; page lives in the URL. */
export function TradesPagination({
  page,
  pageCount,
  total,
  pageSize,
  filters,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  filters: TradesFilters;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const prevHref = `/trades?${tradesFiltersToQuery({ ...filters, page: Math.max(1, page - 1) })}`;
  const nextHref = `/trades?${tradesFiltersToQuery({ ...filters, page: Math.min(pageCount, page + 1) })}`;
  return (
    <nav
      aria-label="Trades pagination"
      className="flex items-center justify-between"
    >
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {total === 0 ? "No trades" : `${from}–${to} of ${total}`}
      </span>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link
            href={prevHref}
            scroll={false}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Prev
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link
            href={nextHref}
            scroll={false}
            aria-disabled={page >= pageCount}
            className={page >= pageCount ? "pointer-events-none opacity-50" : ""}
          >
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </nav>
  );
}
