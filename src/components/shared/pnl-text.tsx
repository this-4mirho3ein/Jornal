import { TrendingDown, TrendingUp } from "lucide-react";

import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Signed, colored P/L text (spec §12.3) — icons back the color for a11y. */
export function PnlText({
  value,
  className,
}: {
  value: string | number | null | undefined;
  className?: string;
}) {
  const n =
    value === null || value === undefined || value === ""
      ? NaN
      : typeof value === "number"
        ? value
        : Number.parseFloat(value);
  const positive = n > 0;
  const negative = n < 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono tabular-nums",
        positive && "text-emerald-600 dark:text-emerald-400",
        negative && "text-red-600 dark:text-red-400",
        className,
      )}
    >
      {positive ? <TrendingUp className="size-3.5" aria-hidden="true" /> : null}
      {negative ? (
        <TrendingDown className="size-3.5" aria-hidden="true" />
      ) : null}
      {formatMoney(value)}
    </span>
  );
}
