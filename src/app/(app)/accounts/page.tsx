import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AccountRow, type AccountRowData } from "@/app/(app)/accounts/account-row";
import { CreateAccountDialog } from "@/app/(app)/accounts/create-account-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { connectionLevel } from "@/features/accounts/connection";
import { getUserAccounts } from "@/features/accounts/queries";
import { getCurrentUser } from "@/lib/auth/guards";
import { formatDateTimeInTz, formatMoney, lastSeenLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Accounts" };

// Admin/config page — deliberately classic navigation: request-time clock
// plus uncached account reads don't need the instant-navigation treatment.
export const instant = false;

/**
 * Row data is fully derived server-side (connection level + relative labels)
 * so the client cards hydrate without clock-dependent text.
 */
async function AccountsContent() {
  // Request-time clock — connection() goes FIRST so the render opts out of
  // the prerender scope before any other awaited work (blocking-prerender).
  await connection();
  const user = await getCurrentUser();
  const accounts = await getUserAccounts(user.id);
  const now = new Date();

  const rows: AccountRowData[] = accounts.map((account) => ({
    id: account.id,
    displayName: account.displayName,
    login: account.login,
    server: account.server,
    broker: account.broker,
    currency: account.currency,
    isDemo: account.isDemo,
    timezone: account.timezone,
    keyPrefix: account.ingestKeyPrefix,
    level: connectionLevel(account.lastSeenAt, now),
    lastSeenLabel: lastSeenLabel(account.lastSeenAt, now),
    lastSeenAbsolute: account.lastSeenAt
      ? formatDateTimeInTz(account.lastSeenAt, account.timezone)
      : null,
    balance: formatMoney(account.lastBalance, { currency: account.currency }),
    equity: formatMoney(account.lastEquity, { currency: account.currency }),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            MT5 connections and ingest keys.
          </p>
        </div>
        <CreateAccountDialog />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Add your first account"
          description="Create an account here, paste its ingest key into JournalSync.mq5 in MetaTrader 5, and trades start syncing automatically."
          action={<CreateAccountDialog triggerLabel="Add your first account" />}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <AccountRow key={row.id} account={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading accounts">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />
        <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />
      </div>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<AccountsSkeleton />}>
      <AccountsContent />
    </Suspense>
  );
}
