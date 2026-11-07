import { Activity, Download, PlugZap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FilterChips } from "@/app/(app)/trades/filter-chips";
import {
  FiltersBar,
  FiltersSheet,
  type FilterOptions,
} from "@/app/(app)/trades/filters";
import { TradesPagination } from "@/app/(app)/trades/pagination";
import { TradeCards } from "@/app/(app)/trades/trade-cards";
import { TradeTable } from "@/app/(app)/trades/trade-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { getUserStrategies } from "@/features/strategies/queries";
import {
  getTradesPage,
  resolveTradesView,
} from "@/features/trades/queries";
import {
  countActiveFilters,
  tradesFiltersToQuery,
} from "@/features/trades/schemas";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Trades" };

type TradesSearchParams = Record<string, string | string[] | undefined>;

export default function TradesPage(props: PageProps<"/trades">) {
  // The promise is awaited inside `<Suspense>` (cacheComponents rule) — the
  // shell prerenders while the filtered content streams.
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="text-lg font-semibold">Trades</h1>
        <p className="text-sm text-muted-foreground">
          Every position the EA syncs — filter, review, export.
        </p>
      </div>
      <Suspense fallback={<TradesSkeleton />}>
        <TradesContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function TradesContent({
  searchParams,
}: {
  searchParams: Promise<TradesSearchParams>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const view = await resolveTradesView(user.id, params);
  const filters = view.filters;
  const [strategies, data] = await Promise.all([
    getUserStrategies(user.id, { includeArchived: true }),
    getTradesPage(user.id, filters),
  ]);

  const options: FilterOptions = {
    symbols: view.facets.symbols,
    strategies: strategies.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
    })),
    setups: view.facets.setupTags,
    mistakes: view.facets.mistakeTags,
  };
  const strategyLabels = new Map(strategies.map((s) => [s.id, s.name]));
  const accountLabel = view.accountId
    ? (data.rows[0]?.accountName ?? null)
    : null;

  const activeCount = countActiveFilters(filters);
  const hasUserFilter =
    countActiveFilters({ ...filters, account: undefined, sort: "opened_desc" }) >
    0;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {data.total} trade{data.total === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <FiltersSheet
              initial={filters}
              options={options}
              activeCount={activeCount}
            />
          </div>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/trades/export${qs(filters)}`}
              download
              aria-label="Export the filtered trades as CSV"
            >
              <Download className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Export CSV</span>
            </a>
          </Button>
        </div>
      </div>

      <div className="hidden md:block">
        <FiltersBar initial={filters} options={options} />
      </div>

      <FilterChips
        filters={filters}
        accountLabel={accountLabel}
        strategyLabels={strategyLabels}
      />

      {data.rows.length === 0 ? (
        hasUserFilter ? (
          <EmptyState
            icon={Activity}
            title="No trades match these filters"
            description="Try widening the date range or removing a chip."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/trades" scroll={false}>
                  Clear all filters
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={PlugZap}
            title="No trades yet"
            description="Attach the EA to one MT5 chart (set InpBackfillDays to pull your past), and every position lands here automatically."
            action={
              <Button asChild size="sm">
                <Link href="/accounts">Set up the EA in Accounts</Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <TradeTable rows={data.rows} timezone={view.timezone} />
          <TradeCards rows={data.rows} timezone={view.timezone} />
          <TradesPagination
            page={data.page}
            pageCount={data.pageCount}
            total={data.total}
            pageSize={data.pageSize}
            filters={filters}
          />
        </>
      )}
    </>
  );
}

function qs(filters: Parameters<typeof tradesFiltersToQuery>[0]): string {
  const query = tradesFiltersToQuery(filters);
  return query ? `?${query}` : "";
}

function TradesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-44 animate-pulse rounded-xl bg-muted" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
