import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";

import { SidebarNav } from "@/components/shared/sidebar-nav";
import { UserMenu } from "@/components/shared/user-menu";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata = {
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
      <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
      <UserMenu name={user.name} email={user.email} />
    </div>
  );
}

function UserAreaFallback() {
  return <div className="bg-muted size-9 animate-pulse rounded-full" aria-hidden="true" />;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            Trading Journal
          </Link>
          <Suspense fallback={<UserAreaFallback />}>
            <UserArea />
          </Suspense>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <aside className="hidden w-48 shrink-0 md:block">
          <SidebarNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
