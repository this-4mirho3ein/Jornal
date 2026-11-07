import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ErrorStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Shared error state (spec §12.4) — centered, calm, with one recovery CTA.
 * Used by `error.tsx` boundaries (retry) and anywhere a view fails locally.
 */
export function ErrorState({
  icon,
  title = "Something went wrong",
  description = "An unexpected error occurred while loading this view.",
  action,
  className,
}: ErrorStateProps) {
  const Icon = icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center sm:p-12",
        className,
      )}
      role="alert"
    >
      {Icon ? <Icon className="size-8 text-destructive" aria-hidden="true" /> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
