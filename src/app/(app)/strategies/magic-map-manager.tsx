"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { removeMagicMapping, setMagicMapping } from "@/features/strategies/actions";
import type { MagicMappingRow } from "@/features/strategies/queries";

export interface MagicMapAccount {
  id: string;
  /** Ready-to-render label, e.g. "FTMO 100k (••••5678 · demo)". */
  label: string;
}

export interface MagicMapStrategy {
  id: string;
  name: string;
  color: string | null;
}

interface MagicMapManagerProps {
  accounts: MagicMapAccount[];
  strategies: MagicMapStrategy[];
  rows: MagicMappingRow[];
}

const MAGIC_MAX = 2_147_483_647;

/**
 * magic → strategy mapping per account (spec §4.3 `magic_strategy_map`).
 * Renaming a row's strategy re-upserts; removing deletes. Rendering is fully
 * server-driven: actions call `router.refresh()` and the fresh RSC payload
 * re-renders the rows — no mirrored local state to drift.
 */
export function MagicMapManager({ accounts, strategies, rows }: MagicMapManagerProps) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [magicInput, setMagicInput] = useState("");
  const [newStrategyId, setNewStrategyId] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const accountRows = selectedAccount
    ? rows.filter((row) => row.accountId === selectedAccount.id)
    : [];

  async function handleAdd() {
    if (!selectedAccount) return;
    const magic = Number(magicInput);
    if (!Number.isInteger(magic) || magic < 0 || magic > MAGIC_MAX) {
      toast.error("Magic must be an integer between 0 and 2147483647.");
      return;
    }
    if (!newStrategyId) {
      toast.error("Pick a strategy for this magic number.");
      return;
    }
    setBusy(true);
    const result = await setMagicMapping({
      accountId: selectedAccount.id,
      magic,
      strategyId: newStrategyId,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMagicInput("");
    setNewStrategyId("");
    toast.success(`Magic ${magic} mapped.`);
    router.refresh();
  }

  async function handleRowChange(magic: number, strategyId: string) {
    if (!selectedAccount) return;
    const result = await setMagicMapping({
      accountId: selectedAccount.id,
      magic,
      strategyId,
    });
    if (!result.ok) {
      toast.error(result.error);
      router.refresh(); // server rows restore the correct value
      return;
    }
    toast.success(`Magic ${magic} updated.`);
    router.refresh();
  }

  async function handleRemove(magic: number) {
    if (!selectedAccount) return;
    const result = await removeMagicMapping({ accountId: selectedAccount.id, magic });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Magic ${magic} unmapped.`);
    router.refresh();
  }

  if (accounts.length === 0 || strategies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {accounts.length === 0
          ? "Create an MT5 account first — mappings attach to an account. "
          : "Create a strategy first — mappings point from a magic number to a strategy. "}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="magic-account" className="sr-only">
          Account
        </label>
        <Select value={selectedAccount?.id} onValueChange={setAccountId}>
          <SelectTrigger id="magic-account" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {accountRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No magic numbers mapped for this account yet — every bot trading on it
          stays unassigned until you map its magic here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {accountRows.map((row) => (
            <li
              key={row.magic}
              className="flex items-center gap-2 rounded-lg border bg-background/40 px-2 py-1.5"
            >
              <code
                className="w-20 shrink-0 rounded bg-muted px-1.5 py-0.5 text-center font-mono text-xs"
                title="MT5 magic number"
              >
                {row.magic}
              </code>
              <span aria-hidden="true" className="text-muted-foreground">
                →
              </span>
              <label className="sr-only" htmlFor={`map-strategy-${row.magic}`}>
                Strategy for magic {row.magic}
              </label>
              <Select
                value={row.strategyId}
                onValueChange={(value) => void handleRowChange(row.magic, value)}
              >
                <SelectTrigger id={`map-strategy-${row.magic}`} className="h-8 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((strategy) => (
                    <SelectItem key={strategy.id} value={strategy.id}>
                      {strategy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground"
                aria-label={`Remove mapping for magic ${row.magic}`}
                onClick={() => void handleRemove(row.magic)}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="magic-new" className="sr-only">
          New magic number
        </label>
        <Input
          id="magic-new"
          inputMode="numeric"
          placeholder="Magic number (e.g. 1001)"
          value={magicInput}
          onChange={(event) => setMagicInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !busy) void handleAdd();
          }}
          className="w-48 font-mono"
        />
        <label htmlFor="magic-new-strategy" className="sr-only">
          Strategy
        </label>
        <Select value={newStrategyId} onValueChange={setNewStrategyId}>
          <SelectTrigger id="magic-new-strategy" className="w-full sm:w-56">
            <SelectValue placeholder="Strategy…" />
          </SelectTrigger>
          <SelectContent>
            {strategies.map((strategy) => (
              <SelectItem key={strategy.id} value={strategy.id}>
                {strategy.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => void handleAdd()} disabled={busy}>
          <Plus className="size-4" aria-hidden="true" />
          Map
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Magic wins over the <code className="font-mono">S:CODE</code> comment marker
        when both are present.
      </p>
    </div>
  );
}
