"use client";

import { Ellipsis, MessageSquareWarning, Pencil, RotateCcw } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConnectionDot } from "@/components/shared/connection-dot";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { IngestKeyReveal } from "@/app/(app)/accounts/ingest-key-reveal";
import type { ConnectionLevel } from "@/features/accounts/connection";
import {
  archiveAccount,
  renameAccount,
  rotateIngestKey,
} from "@/features/accounts/actions";

/** Everything the row renders, precomputed server-side (clock-safe). */
export interface AccountRowData {
  id: string;
  displayName: string;
  login: number | null;
  server: string | null;
  broker: string | null;
  currency: string;
  isDemo: boolean;
  timezone: string;
  keyPrefix: string;
  lastSeenLabel: string;
  lastSeenAbsolute: string | null;
  level: ConnectionLevel;
  balance: string;
  equity: string;
}

interface AccountRowProps {
  account: AccountRowData;
}

export function AccountRow({ account }: AccountRowProps) {
  const router = useRouter();
  const [reveal, setReveal] = useState<{ key: string; keyPrefix: string } | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  function handleError(result: { ok: boolean; error?: string }) {
    if (!result.ok) toast.error(result.error ?? "Something went wrong.");
    else router.refresh();
  }

  async function handleRename(displayName: string): Promise<boolean> {
    const result = await renameAccount({ accountId: account.id, displayName });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success("Account renamed.");
    router.refresh();
    return true;
  }

  async function handleRotate(): Promise<void> {
    const result = await rotateIngestKey({ accountId: account.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setReveal(result.data);
    toast.success("Ingest key rotated — copy the new key now.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <span className="truncate">{account.displayName}</span>
          <Badge variant="outline" className="shrink-0 px-1.5 text-[10px]">
            {account.isDemo ? "DEMO" : "LIVE"}
          </Badge>
          <RenameInline currentName={account.displayName} onRename={handleRename} />
        </CardTitle>
        <CardDescription className="truncate">
          {account.login !== null
            ? [
                `${account.currency}`,
                account.broker,
                account.server,
                `Login ••••${String(account.login).slice(-4)}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Not connected — waiting for the MT5 EA's first handshake"}
        </CardDescription>
        <CardAction className="flex items-center gap-1">
          <ConnectionDot level={account.level} withLabel />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${account.displayName}`}
                className="size-8"
              >
                <Ellipsis className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard
                    .writeText(account.keyPrefix)
                    .then(() =>
                      toast.info(
                        "Key prefix copied — the full key is only visible right after rotate.",
                      ),
                    )
                    .catch(() => toast.error("Clipboard unavailable."));
                }}
              >
                Copy key prefix
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setRotateOpen(true);
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Rotate key…
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setArchiveOpen(true)}
              >
                <MessageSquareWarning className="size-4" aria-hidden="true" />
                Archive…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Balance" value={account.balance} />
        <Stat label="Equity" value={account.equity} />
        <Stat
          label="Last seen"
          value={account.lastSeenLabel}
          title={account.lastSeenAbsolute}
        />
        <Stat label="Timezone" value={account.timezone} mono />
      </CardContent>
      <ConfirmDialog
        destructive
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Rotate ingest key?"
        description={`The current key stops working immediately. Point the MT5 EA on "${account.displayName}" at the new key after rotating.`}
        confirmLabel="Rotate key"
        onConfirm={handleRotate}
      />
      <ConfirmDialog
        destructive
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive "${account.displayName}"?`}
        description="Archived accounts disappear from lists and the switcher. Nothing is deleted — trades and the ingest key stay, and adding the account again with the same login + server restores it."
        confirmLabel="Archive account"
        onConfirm={async () => {
          const result = await archiveAccount({
            accountId: account.id,
            archived: true,
          });
          handleError(result);
        }}
      />
      {reveal ? (
        <IngestKeyReveal
          title="Rotate complete — new ingest key"
          description="Copy it now; it is shown only once and replaces the old key immediately."
          result={reveal}
          onClose={() => setReveal(null)}
        />
      ) : null}
    </Card>
  );
}

function Stat({
  label,
  value,
  title,
  mono = false,
}: {
  label: string;
  value: string;
  title?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          mono
            ? "truncate font-mono text-sm tabular-nums"
            : "truncate text-sm font-medium tabular-nums"
        }
        title={title ?? undefined}
      >
        {value}
      </p>
    </div>
  );
}

/** Inline rename (spec §8.1): pencil → popover input, Enter/✓ saves. */
function RenameInline({
  currentName,
  onRename,
}: {
  currentName: string;
  onRename: (name: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentName);
  const [busy, setBusy] = useState(false);

  async function save() {
    const name = value.trim();
    if (!name || name === currentName) {
      setOpen(false);
      return;
    }
    setBusy(true);
    const ok = await onRename(name);
    setBusy(false);
    if (ok) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className="shrink-0" aria-label={`Rename ${currentName}`}>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={(event) => {
            setValue(currentName);
            event.stopPropagation();
          }}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="flex gap-2">
          <Input
            value={value}
            aria-label="Account name"
            maxLength={80}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !busy) void save();
              if (event.key === "Escape") setOpen(false);
            }}
          />
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={busy || !value.trim()}
          >
            {busy ? "…" : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
