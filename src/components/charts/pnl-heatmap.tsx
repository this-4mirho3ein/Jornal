"use client";

import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface HeatmapDay {
  day: string;
  pnl: string;
  n: number;
}

/**
 * §10/§12 — CSS-grid daily P/L calendar. Grid keys come from the server
 * (rendered inside Suspense with connection()), so no client clock touches
 * the render. Intensity scales by |P/L|; tooltips + text keep it usable
 * without hover (§12.2 touch rule).
 */
export function PnlHeatmap({
  days,
  currency,
}: {
  days: HeatmapDay[];
  currency: string;
}) {
  const values = days.map((d) => Math.abs(Number(d.pnl)));
  const maxAbs = Math.max(1, ...values);

  return (
    <div
      className="grid grid-cols-10 gap-1"
      role="table"
      aria-label="Daily profit and loss, last 30 days"
    >
      {days.map((day) => {
        const value = Number(day.pnl);
        const ratio = Math.min(1, Math.abs(value) / maxAbs);
        const alpha = 0.18 + ratio * 0.5;
        const background =
          value > 0
            ? `rgba(16, 185, 129, ${alpha.toFixed(2)})`
            : value < 0
              ? `rgba(239, 68, 68, ${alpha.toFixed(2)})`
              : undefined;
        return (
          <div
            key={day.day}
            title={`${day.day} — ${formatMoney(day.pnl, { currency, signed: true })} (${day.n} trade${day.n === 1 ? "" : "s"})`}
            className={cn(
              "flex h-9 items-center justify-center rounded-md border font-mono text-[9px] tabular-nums",
              value > 0 && "text-emerald-700 dark:text-emerald-300",
              value < 0 && "text-red-700 dark:text-red-300",
              value === 0 && "bg-muted text-muted-foreground",
            )}
            style={{ background }}
          >
            {day.day.slice(8)}
          </div>
        );
      })}
    </div>
  );
}
