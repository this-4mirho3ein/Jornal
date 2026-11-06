"use client";

import { Check, ChevronsUpDown, Layers } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CONNECTION_DOT_CLASS } from "@/components/shared/connection-dot";
import { maskLogin } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConnectionLevel } from "@/features/accounts/connection";
import { setActiveAccountCookie } from "@/features/accounts/actions";

/** Serializable slice of a trading account for the client switcher. */
export interface SwitcherAccount {
  id: string;
  displayName: string;
  login: number | null;
  broker: string | null;
  isDemo: boolean;
  currency: string;
  lastSeenAt: Date | string | null;
  level: ConnectionLevel;
}

interface AccountSwitcherProps {
  accounts: SwitcherAccount[];
  /** Cookie/first-account resolution from the server (null = "All accounts"). */
  serverActiveId: string | null;
  /** True when every account shares one currency (§8.1 gate for "All"). */
  allCurrencyUniform: boolean;
}

function itemSecondary(account: SwitcherAccount): string {
  const parts = [maskLogin(account.login), account.broker].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function AccountSwitcher({
  accounts,
  serverActiveId,
  allCurrencyUniform,
}: AccountSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const ids = new Set(accounts.map((account) => account.id));
  const urlId = searchParams.get("account");
  const activeId =
    urlId !== null && ids.has(urlId)
      ? urlId
      : urlId !== null
        ? null // foreign id in URL: switcher shows aggregate; page falls back server-side
        : serverActiveId;
  const active = accounts.find((account) => account.id === activeId) ?? null;

  function select(id: string | null) {
    setOpen(false);
    const params = new URLSearchParams(searchParams);
    if (id) params.set("account", id);
    else params.delete("account");
    const query = params.toString();
    startTransition(async () => {
      await setActiveAccountCookie(id);
      router.push(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Switch trading account"
          disabled={pending}
          className="max-w-[190px] justify-between gap-1.5 font-normal sm:max-w-[240px]"
        >
          <Layers
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="truncate">
            {active
              ? active.displayName
              : accounts.length > 0
                ? "All accounts"
                : "No account"}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-64 p-0"
      >
        <Command>
          <CommandInput placeholder="Search accounts…" />
          <CommandList>
            {accounts.length === 0 ? (
              <CommandEmpty>
                No accounts yet — add one on the Accounts page.
              </CommandEmpty>
            ) : (
              <>
                <CommandGroup>
                  <CommandItem
                    value="all-accounts"
                    disabled={!allCurrencyUniform}
                    onSelect={() => select(null)}
                    className="gap-2"
                  >
                    <Layers
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1">All accounts</span>
                    {!allCurrencyUniform ? (
                      <span className="text-xs text-muted-foreground">
                        mixed currencies
                      </span>
                    ) : null}
                    {activeId === null && allCurrencyUniform ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : null}
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Accounts">
                  {accounts.map((account) => (
                    <CommandItem
                      key={account.id}
                      value={`${account.displayName} ${account.login ?? ""} ${account.broker ?? ""}`}
                      onSelect={() => select(account.id)}
                      className="gap-2"
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          CONNECTION_DOT_CLASS[account.level],
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{account.displayName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {itemSecondary(account)}
                        </span>
                      </span>
                      <Badge variant="outline" className="shrink-0 px-1.5 text-[10px]">
                        {account.isDemo ? "DEMO" : "LIVE"}
                      </Badge>
                      {account.id === activeId ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
