"use client";

import dynamic from "next/dynamic";

/** Lazy chart wrappers (§13 JS budget — recharts never blocks first paint). */
function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-lg bg-muted"
      style={{ height }}
      aria-hidden="true"
    />
  );
}

export const EquityCurveLazy = dynamic(
  () => import("@/components/charts/charts").then((m) => m.EquityCurveChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const BreakdownBarsLazy = dynamic(
  () => import("@/components/charts/charts").then((m) => m.BreakdownBars),
  { ssr: false, loading: () => <ChartSkeleton height={160} /> },
);

export const RDistributionLazy = dynamic(
  () => import("@/components/charts/charts").then((m) => m.RDistributionChart),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> },
);

export const WinLossDonutLazy = dynamic(
  () => import("@/components/charts/charts").then((m) => m.WinLossDonut),
  { ssr: false, loading: () => <ChartSkeleton height={210} /> },
);

export const BreakdownColumnsLazy = dynamic(
  () => import("@/components/charts/charts").then((m) => m.BreakdownColumns),
  { ssr: false, loading: () => <ChartSkeleton height={220} /> },
);
