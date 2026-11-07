import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Buy/sell chip (§12.3) — arrow icon doubles the color for color-blind users. */
export function DirectionBadge({
  direction,
  className,
}: {
  direction: "buy" | "sell";
  className?: string;
}) {
  const buy = direction === "buy";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium",
        buy
          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
          : "border-red-500/40 text-red-600 dark:text-red-400",
        className,
      )}
    >
      {buy ? (
        <ArrowUpRight className="size-3" aria-hidden="true" />
      ) : (
        <ArrowDownRight className="size-3" aria-hidden="true" />
      )}
      {buy ? "Buy" : "Sell"}
    </Badge>
  );
}
