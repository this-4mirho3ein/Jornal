"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { useTradeFlash } from "@/components/realtime/use-trade-flash";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Full-row navigation into the trade detail (§8.2). The row is a pointer
 * convenience only — the symbol cell keeps the semantic anchor, so keyboard
 * users, screen readers and Cmd/middle-click new-tab behavior stay intact.
 * Realtime `trade.updated` events flash the matching row for ~1.5 s (§6.5.4).
 */
export function TradesRowLink({
  href,
  tradeId,
  children,
}: {
  href: string;
  tradeId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const flash = useTradeFlash(tradeId);

  function onRowClick(event: MouseEvent<HTMLTableRowElement>) {
    if (event.target instanceof Element && event.target.closest("a,button")) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener");
      return;
    }
    router.push(href);
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href);
    }
  }

  return (
    <TableRow
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={onRowKeyDown}
      className={cn("cursor-pointer", flash && "tj-row-flash")}
    >
      {children}
    </TableRow>
  );
}
