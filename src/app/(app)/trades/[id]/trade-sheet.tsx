"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Side sheet hosting the trade detail when intercepted from the list. */
export function TradeSheet({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          router.back();
        }
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl"
      >
        <SheetHeader className="px-4 pb-2 pt-4">
          <SheetTitle>Trade details</SheetTitle>
          <SheetDescription>
            Journal, screenshots and timeline — autosaved as you type.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
