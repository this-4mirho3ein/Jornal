import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/**
 * Public marketing shell (spec §14): indexable, minimal chrome, almost no
 * client JS — only the theme toggle ships a bundle here. Footer is part of
 * the shell because the landing hero provides the page's <main> content.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
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
            <span className="hidden min-[420px]:inline">Trading Journal</span>
          </Link>
          <nav
            aria-label="Site"
            className="flex items-center gap-2 sm:gap-4"
          >
            <a
              href="#features"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
            >
              Features
            </a>
            <a
              href="#how"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
            >
              How it works
            </a>
            <a
              href="#faq"
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
            >
              FAQ
            </a>
            <ThemeToggle />
            <Button asChild size="sm">
              <a href="/login">Sign in</a>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>Trading Journal — a private, realtime MetaTrader 5 journal.</p>
          <nav aria-label="Footer" className="flex items-center gap-4">
            <a className="transition-colors hover:text-foreground" href="#faq">
              FAQ
            </a>
            <Link className="transition-colors hover:text-foreground" href="/login">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
