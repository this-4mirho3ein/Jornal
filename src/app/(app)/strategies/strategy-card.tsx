"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StrategyFormDialog } from "@/app/(app)/strategies/strategy-form-dialog";
import { StyleBadge } from "@/components/shared/style-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { archiveStrategy } from "@/features/strategies/actions";
import type { TradeStyleValue } from "@/lib/trade-style";
import { cn } from "@/lib/utils";

/** Everything the card renders, precomputed server-side (client-safe). */
export interface StrategyCardData {
  id: string;
  name: string;
  code: string;
  color: string | null;
  description: string | null;
  /** TradeStyleValue | null — stays a string to keep this component server-agnostic. */
  defaultStyle: string | null;
  archived: boolean;
}

export function StrategyCard({ strategy }: { strategy: StrategyCardData }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  async function setArchived(archived: boolean) {
    const result = await archiveStrategy({ strategyId: strategy.id, archived });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(archived ? "Strategy archived." : "Strategy restored.");
    router.refresh();
  }

  return (
    <Card className={cn(strategy.archived && "opacity-60")}>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          {strategy.color ? (
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: strategy.color }}
            />
          ) : null}
          <span className="truncate">{strategy.name}</span>
          {strategy.archived ? (
            <Badge variant="outline" className="shrink-0 px-1.5 text-[10px]">
              Archived
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <code
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
            title="Type this into the MT5 order comment to tag manual trades"
          >
            S:{strategy.code}
          </code>
          {strategy.defaultStyle ? (
            <StyleBadge style={strategy.defaultStyle as TradeStyleValue} />
          ) : null}
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${strategy.name}`}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {strategy.archived ? (
                <DropdownMenuItem onClick={() => void setArchived(false)}>
                  <ArchiveRestore className="size-4" aria-hidden="true" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" onClick={() => setArchiveOpen(true)}>
                  <Archive className="size-4" aria-hidden="true" />
                  Archive…
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      {strategy.description ? (
        <CardContent>
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {strategy.description}
          </p>
        </CardContent>
      ) : null}
      <StrategyFormDialog
        strategy={{
          id: strategy.id,
          name: strategy.name,
          code: strategy.code,
          color: strategy.color,
          description: strategy.description,
          defaultStyle: strategy.defaultStyle,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <ConfirmDialog
        destructive
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive "${strategy.name}"?`}
        description="Existing trades keep their assignment. The strategy is hidden from the mapping manager and new-trade auto-assignment until restored."
        confirmLabel="Archive strategy"
        onConfirm={() => setArchived(true)}
      />
    </Card>
  );
}
