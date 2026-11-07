"use client";

import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  MoreHorizontal,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Primary mobile tabs (spec §12.2) — the sidebar collapses to this bar. */
const TABS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: ArrowLeftRight },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/accounts", label: "Accounts", icon: Wallet },
] as const;

/**
 * Bottom tab bar (§12.2): Dashboard/Trades/Analytics/Accounts + a More menu
 * for the secondary destinations. Owns the safe-area inset so content above
 * only needs matching bottom padding.
 */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                active
                  ? "font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="size-5" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More pages"
            className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            More
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" sideOffset={8}>
            <DropdownMenuItem asChild>
              <Link href="/strategies">Strategies</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
