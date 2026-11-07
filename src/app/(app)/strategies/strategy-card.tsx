"use client";

import { Archive, ArchiveRestore, Pencil, Star } from "lucide-react";
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
import { archiveStrategy, setDefaultStrategy } from "@/features/strategies/actions";
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

interface StrategyCardProps {
  strategy: StrategyCardData;
  /** Active account the default toggle acts on (null → toggle hidden). */
  activeAccountId: string | null;
  activeAccountName: string | null;
  /** Whether this strategy IS the active account's default. */
  isDefault: boolean;
}

export function StrategyCard({
  strategy,
  activeAccountId,
  activeAccountName,
  isDefault,
}: StrategyCardProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [defaultBusy, setDefaultBusy] = useState(false);

  async function setArchived(archived: boolean) {
    const result = await archiveStrategy({ strategyId: strategy.id, archived });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(archived ? "Strategy archived." : "Strategy restored.");
    router.refresh();
  }

  async function toggleDefault() {
    if (!activeAccountId) return;
    setDefaultBusy(true);
    const result = await setDefaultStrategy({
      accountId: activeAccountId,
      strategyId: isDefault ? null : strategy.id,
    });
    setDefaultBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      isDefault
        ? `"${strategy.name}" is no longer the default for ${activeAccountName ?? "this account"}.`
        : `New ${activeAccountName ?? "account"} trades use "${strategy.name}" when no magic/comment matches.`,
    );
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
          <div className="flex items-center gap-1.5">
            {activeAccountId ? (
              <Button
                type="button"
                variant={isDefault ? "secondary" : "outline"}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                aria-pressed={isDefault}
                disabled={defaultBusy || (strategy.archived && !isDefault)}
                aria-label={
                  isDefault
                    ? `Clear ${strategy.name} as the default strategy for ${activeAccountName ?? "this account"}`
                    : `Make ${strategy.name} the default strategy for ${activeAccountName ?? "this account"}`
                }
                onClick={() => void toggleDefault()}
              >
                <Star
                  className={cn(
                    "size-3.5",
                    isDefault && "fill-amber-400 text-amber-500",
                  )}
                  aria-hidden="true"
                />
                {isDefault ? "Default" : "Set default"}
              </Button>
            ) : null}
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
          </div>
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
