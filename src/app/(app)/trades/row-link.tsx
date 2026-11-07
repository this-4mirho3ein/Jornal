"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { TableRow } from "@/components/ui/table";

/**
 * Full-row navigation into the trade detail (§8.2). The row is a pointer
 * convenience only — the symbol cell keeps the semantic anchor, so keyboard
 * users, screen readers and Cmd/middle-click new-tab behavior stay intact.
 */
export function TradesRowLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function onRowClick(event: MouseEvent<HTMLTableRowElement>) {
    if (event.target instanceof Element && event.target.closest("a,button")) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener");
      return;
    }
    router.push(href, { scroll: false });
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href, { scroll: false });
    }
  }

  return (
    <TableRow
      tabIndex={0}
      onClick={onRowClick}
      onKeyDown={onRowKeyDown}
      className="cursor-pointer"
    >
      {children}
    </TableRow>
  );
}
