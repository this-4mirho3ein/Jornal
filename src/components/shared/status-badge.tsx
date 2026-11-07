import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Open/closed chip (§12.3) — amber pulse while the position is live. */
export function StatusBadge({
  status,
  className,
}: {
  status: "open" | "closed";
  className?: string;
}) {
  if (status === "open") {
    return (
      <Badge
        className={cn(
          "gap-1.5 bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
          className,
        )}
      >
        <span
          className="size-1.5 animate-pulse rounded-full bg-current"
          aria-hidden="true"
        />
        Open
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("text-muted-foreground", className)}>
      Closed
    </Badge>
  );
}
