import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StrategyBadgeProps {
  name: string;
  /** Strategy color (hex) chosen by the user; null → dot-less chip. */
  color?: string | null;
  className?: string;
}

/** Strategy chip with the user-chosen color dot — used everywhere trades are labeled. */
export function StrategyBadge({ name, color, className }: StrategyBadgeProps) {
  return (
    <Badge variant="outline" className={cn("gap-1.5", className)}>
      {color ? (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {name}
    </Badge>
  );
}
