import Link from "next/link";

import { cn } from "@/lib/utils";
import type { DashboardPeriod } from "@/features/dashboard/queries";

const PERIODS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

/** Period selector chips — period lives in the URL like every §11 filter. */
export function PeriodChips({
  current,
  searchParams,
}: {
  current: DashboardPeriod;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "period" || value === undefined) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  return (
    <div role="group" aria-label="Period" className="flex rounded-lg border p-0.5">
      {PERIODS.map((period) => (
        <Link
          key={period.value}
          href={(() => {
            const next = new URLSearchParams(params);
            if (period.value !== "30d") next.set("period", period.value);
            else next.delete("period");
            const qs = next.toString();
            return qs ? `?${qs}` : "?";
          })()}
          scroll={false}
          aria-pressed={current === period.value}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            current === period.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {period.label}
        </Link>
      ))}
    </div>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** ISO weekday number (1=Mon … 7=Sun) → label. */
export function weekdayLabel(isoDow: string): string {
  const index = Number.parseInt(isoDow, 10);
  return WEEKDAYS[index - 1] ?? isoDow;
}

export function hourLabel(hour: string): string {
  return `${hour.padStart(2, "0")}:00`;
}
