import type { ReactNode } from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";

import {
  AccountSwitcher,
  type SwitcherAccount,
} from "@/components/shared/account-switcher";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import { getActiveAccount } from "@/features/accounts/active-account";
import { connectionLevel } from "@/features/accounts/connection";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Session reads sit behind <Suspense> — never at layout top level — so the
 * chrome prerenders and only the user area streams (installed Next.js guide:
 * "Authentication with Cache Components"). The unauthenticated redirect
 * happens inside that boundary at request time.
 */
async function UserArea() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {user.email}
      </span>
      <UserMenu name={user.name} email={user.email} />
    </div>
  );
}

/** Account switcher (spec §8.1) — streams in next to the brand link. */
async function SwitcherArea() {
  const user = await getCurrentUser();
  const { account, accounts } = await getActiveAccount(user.id);
  // "Now" is an unstable value under cacheComponents — opt this subtree into
  // request-time rendering (installed docs / blocking-prerender-current-time).
  await connection();
  const now = new Date();

  const items: SwitcherAccount[] = accounts.map((item) => ({
    id: item.id,
    displayName: item.displayName,
    login: item.login,
    broker: item.broker,
    isDemo: item.isDemo,
    currency: item.currency,
    lastSeenAt: item.lastSeenAt,
    level: connectionLevel(item.lastSeenAt, now),
  }));
  const currencies = new Set(accounts.map((item) => item.currency));

  return (
    <AccountSwitcher
      accounts={items}
      serverActiveId={account?.id ?? null}
      allCurrencyUniform={currencies.size <= 1}
    />
  );
}

function UserAreaFallback() {
  return (
    <div className="size-9 animate-pulse rounded-full bg-muted" aria-hidden="true" />
  );
}

function SwitcherFallback() {
  return (
    <div className="h-8 w-40 animate-pulse rounded-md bg-muted" aria-hidden="true" />
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <Image
                src="/brand/logo.png"
                alt=""
                width={42}
                height={28}
                priority
                className="rounded-md"
              />
              <span>Trading Journal</span>
            </Link>
            <Suspense fallback={<SwitcherFallback />}>
              <SwitcherArea />
            </Suspense>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Suspense fallback={<UserAreaFallback />}>
              <UserArea />
            </Suspense>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <aside className="hidden w-48 shrink-0 md:block">
          {/* usePathname() is URL data — stream the nav like the switcher */}
          <Suspense
            fallback={
              <nav aria-hidden="true" className="flex flex-col gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
                ))}
              </nav>
            }
          >
            <SidebarNav />
          </Suspense>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
