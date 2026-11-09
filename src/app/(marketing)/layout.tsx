import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import HeaderSession, { HeaderAuthActions } from "@/app/(marketing)/header-session";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * Public marketing shell (spec §14): indexable, minimal chrome, almost no
 * client JS — only the theme toggle ships a bundle here. The header's auth
 * slot streams inside Suspense (PPR): the prerendered shell carries the
 * signed-out actions; signed-in visitors get the profile chip swapped in.
 * Footer is part of the shell because the landing hero provides <main>.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/70">
        {/* Three-zone header (owner request, 2026-11): logo left, nav exactly
            centered (grid 1fr/auto/1fr), theme toggle + account right. The
            anchors jump to the landing sections from any page ("#…" would
            only work on "/"), and visibility tiers keep every viewport free
            of collisions: Guide/Tools from 420px, section anchors from lg. */}
        <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
            aria-label="Trading Journal — home"
          >
            <Image
              src="/brand/logo.png"
              alt=""
              width={42}
              height={28}
              priority
              className="rounded-md"
            />
            <span className="hidden md:inline">Trading Journal</span>
          </Link>
          <nav
            aria-label="Site"
            className="flex items-center justify-center gap-3 sm:gap-4"
          >
            <Link
              href="/guide"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground min-[420px]:inline-block"
            >
              Guide
            </Link>
            <Link
              href="/tools/manager-pro"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground min-[420px]:inline-block"
            >
              Tools
            </Link>
            <a
              href="/#features"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-block"
            >
              Features
            </a>
            <a
              href="/#how"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-block"
            >
              How it works
            </a>
            <a
              href="/#faq"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-block"
            >
              FAQ
            </a>
          </nav>
          <div className="flex items-center justify-end gap-2">
            <ThemeToggle />
            <Suspense fallback={<HeaderAuthActions />}>
              <HeaderSession />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>Trading Journal — a private, realtime MetaTrader 5 journal.</p>
          <nav aria-label="Footer" className="flex items-center gap-4">
            <Link className="transition-colors hover:text-foreground" href="/guide">
              Setup guide
            </Link>
            <Link
              className="transition-colors hover:text-foreground"
              href="/tools/manager-pro"
            >
              ManagerPro EA
            </Link>
            <a className="transition-colors hover:text-foreground" href="/#faq">
              FAQ
            </a>
            <Link className="transition-colors hover:text-foreground" href="/login">
              Sign in
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/register">
              Get started
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
