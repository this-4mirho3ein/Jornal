import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "positive" | "negative" | "info" | "muted";

const TONE_CLASS: Record<StatTone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  info: "text-foreground",
  muted: "text-muted-foreground",
};

/** §12.3 StatCard — label, signed value, icon; color never travels alone. */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "info",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </span>
        <span className={cn("font-mono text-lg font-semibold tabular-nums", TONE_CLASS[tone])}>
          {value}
        </span>
        {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
      </CardContent>
    </Card>
  );
}
