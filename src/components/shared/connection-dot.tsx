import { cn } from "@/lib/utils";
import type { ConnectionLevel } from "@/features/accounts/connection";

export const CONNECTION_DOT_CLASS: Record<ConnectionLevel, string> = {
  live: "bg-emerald-500",
  delayed: "bg-amber-500",
  offline: "bg-red-500/70",
};

const LEVEL_LABEL: Record<ConnectionLevel, string> = {
  live: "Live",
  delayed: "Delayed",
  offline: "Offline",
};

interface ConnectionDotProps {
  level: ConnectionLevel;
  /** Render `Live/Delayed/Offline` text next to the dot. */
  withLabel?: boolean;
  className?: string;
}

/**
 * Heartbeat indicator (spec §8.1): green < 3 min, amber < 15 min, red beyond;
 * `level` comes from `connectionLevel()` — server-computed or client-ticked.
 */
export function ConnectionDot({
  level,
  withLabel = false,
  className,
}: ConnectionDotProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
      role="img"
      aria-label={`Connection: ${LEVEL_LABEL[level]}`}
    >
      <span
        className={cn("inline-block size-2 rounded-full", CONNECTION_DOT_CLASS[level])}
        aria-hidden="true"
      />
      {withLabel ? <span>{LEVEL_LABEL[level]}</span> : null}
    </span>
  );
}
