import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { styleLabels, type TradeStyleValue } from "@/lib/trade-style";

/**
 * Hue per style — low-saturation tints that hold AA contrast on both themes
 * (§12.1 semantic colors; never red/green, those are reserved for P/L).
 */
const STYLE_CLASS: Record<TradeStyleValue, string> = {
  scalp: "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  day: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  swing: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  position: "bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
};

export const STYLE_BADGE_CLASS = STYLE_CLASS;

interface StyleBadgeProps {
  style: TradeStyleValue;
  /** §9: automatic values carry an "Auto" tag, manual overrides don't. */
  source?: "auto" | "manual";
  className?: string;
}

export function StyleBadge({ style, source, className }: StyleBadgeProps) {
  return (
    <Badge
      variant="secondary"
      title={source === "auto" ? "Auto-detected from hold time" : undefined}
      className={cn("gap-1", STYLE_CLASS[style], className)}
    >
      {styleLabels[style]}
      {source === "auto" ? (
        <span className="text-[10px] font-normal opacity-60" aria-hidden="true">
          · auto
        </span>
      ) : null}
    </Badge>
  );
}
