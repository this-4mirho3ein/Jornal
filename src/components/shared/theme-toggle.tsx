"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Light/dark switch (spec §12.1–12.2 — dark is the default).
 * Pure-CSS state: the `.dark` class next-themes applies pre-paint moves the
 * knob and swaps the glyphs, so there is no mounted state, no effect, and no
 * hydration mismatch. Clicking reads the live class and flips an explicit
 * light/dark; until the first click the configured default still applies.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() =>
        setTheme(
          document.documentElement.classList.contains("dark")
            ? "light"
            : "dark",
        )
      }
      className={cn(
        // ::before extends the 24px-tall switch to a 44px touch target (§12.1)
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-input transition-colors outline-none outline-offset-2 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background before:absolute before:inset-x-0 before:-inset-y-2.5 before:rounded-lg before:content-[''] dark:bg-foreground/15",
        className,
      )}
    >
      <Moon
        className="absolute left-1 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Sun
        className="absolute right-1 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      {/* 20px knob in the 24px track, inset 4px on each side: in light it
          covers the moon glyph (4–18px), in dark it travels 20px so it covers
          the sun glyph (26–40px). The previous 16px knob + 24px travel left a
          2px sliver of the sun visible in dark mode. */}
      <span
        aria-hidden="true"
        className="absolute left-1 top-1/2 size-5 -translate-y-1/2 rounded-full bg-background shadow-sm transition-transform dark:translate-x-5"
      />
    </button>
  );
}
