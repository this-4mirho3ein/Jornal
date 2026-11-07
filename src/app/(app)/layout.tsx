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
import { ConnectionDot } from "@/components/shared/connection-dot";
import { MobileTabBar } from "@/components/shared/mobile-tab-bar";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import { RealtimeGate } from "@/components/realtime/realtime-gate";
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
  // Request-time clock — connection() first, before any awaited work.
  await connection();
  const user = await getCurrentUser();
  const { account, accounts } = await getActiveAccount(user.id);
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
    <div className="flex items-center gap-2.5">
      <AccountSwitcher
        accounts={items}
        serverActiveId={account?.id ?? null}
        allCurrencyUniform={currencies.size <= 1}
      />
      {/* EA heartbeat badge in the top bar (§8.1), driven by last_seen_at */}
      <ConnectionDot
        level={account ? connectionLevel(account.lastSeenAt, now) : "offline"}
        withLabel
        className="hidden sm:inline-flex"
      />
    </div>
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
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
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
              {/* Text hides on the narrowest phones — the switcher gets the room (§12.2) */}
              <span className="hidden min-[480px]:inline">Trading Journal</span>
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

      {/* Extra bottom padding on mobile clears the tab bar + safe area (§12.2) */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-6 md:pb-6">
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

      {/* §12.2 — sidebar collapses to a bottom tab bar on mobile
          (usePathname is URL data — stream it like the sidebar nav) */}
      <Suspense fallback={null}>
        <MobileTabBar />
      </Suspense>

      {/* §6.5 — lives outside the visible tree: subscribes (or polls, flag
          off) and refreshes/toasts on trade events; renders null either way */}
      <Suspense fallback={null}>
        <RealtimeGate />
      </Suspense>
    </div>
  );
}
