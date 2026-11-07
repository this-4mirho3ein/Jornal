"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * §8.2 — side-sheet host for the intercepted trade detail.
 *
 * Deliberately NOT a Radix portal: portal content escapes the route segment's
 * tree, and Next 16's instant-navigation validation then cannot attribute the
 * rendered UI to this segment (it reports the segment as dropped). This
 * drawer renders in-tree, in the same portal-less flow as the page, with
 * tw-animate-css for the entrance.
 */
export function TradeSheet({ children }: { children: ReactNode }) {
  const router = useRouter();

  function close() {
    router.back();
  }

  // Escape closes — same contract the Radix sheet had.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Trade details"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        onClick={close}
        aria-hidden="true"
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto bg-background shadow-xl outline-none",
          "motion-safe:animate-in motion-safe:slide-in-from-right-10 motion-safe:fade-in motion-safe:duration-200",
        )}
      >
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
          <div>
            <h2 className="text-sm font-semibold">Trade details</h2>
            <p className="text-xs text-muted-foreground">
              Journal, screenshots and timeline — autosaved as you type.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close trade details"
            onClick={close}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-4 pb-8">{children}</div>
      </div>
    </div>
  );
}
