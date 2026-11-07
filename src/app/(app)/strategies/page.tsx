import { GitBranch, Star, TextCursorInput } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { StrategyFormDialog } from "@/app/(app)/strategies/strategy-form-dialog";
import { StrategyCard, type StrategyCardData } from "@/app/(app)/strategies/strategy-card";
import {
  MagicMapManager,
  type MagicMapAccount,
} from "@/app/(app)/strategies/magic-map-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { getActiveAccount } from "@/features/accounts/active-account";
import { getUserAccounts } from "@/features/accounts/queries";
import {
  getMagicMappings,
  getUserStrategies,
} from "@/features/strategies/queries";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Strategies" };

/**
 * Row data is precomputed server-side into plain shapes so client cards
 * hydrate without Date objects or DB types crossing the RSC boundary.
 */
async function StrategiesContent() {
  const user = await getCurrentUser();
  const [strategyRows, accounts, mappings, active] = await Promise.all([
    getUserStrategies(user.id, { includeArchived: true }),
    getUserAccounts(user.id),
    getMagicMappings(user.id),
    getActiveAccount(user.id),
  ]);
  const activeAccount = active.account;

  const cards: StrategyCardData[] = strategyRows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    color: row.color,
    description: row.description,
    defaultStyle: row.defaultStyle,
    archived: row.archivedAt !== null,
  }));

  const activeStrategies = cards.filter((card) => !card.archived);
  const mapAccounts: MagicMapAccount[] = accounts.map((account) => ({
    id: account.id,
    label:
      account.login !== null
        ? `${account.displayName} (••••${String(account.login).slice(-4)}${account.isDemo ? " · demo" : ""})`
        : `${account.displayName}${account.isDemo ? " (demo)" : ""}`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Strategies</h1>
          <p className="text-sm text-muted-foreground">
            Tag setups once — trades are labeled automatically from MT5.
          </p>
        </div>
        <StrategyFormDialog triggerLabel="New strategy" />
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Create your first strategy"
          description="Define the setups you trade. Manual trades get tagged by writing S:CODE in the MT5 order comment; bot trades by mapping the EA's magic number below."
          action={<StrategyFormDialog triggerLabel="Create your first strategy" />}
        />
      ) : (
        <>
          {activeAccount ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="size-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
              Default = the strategy new {activeAccount.displayName} trades get when
              no magic mapping and no order-comment code matches.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {cards.map((card) => (
              <StrategyCard
                key={card.id}
                strategy={card}
                activeAccountId={activeAccount?.id ?? null}
                activeAccountName={activeAccount?.displayName ?? null}
                isDefault={activeAccount?.defaultStrategyId === card.id}
              />
            ))}
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Magic number mapping</CardTitle>
          <p className="text-sm text-muted-foreground">
            Map each bot&apos;s EA magic number to a strategy — every trade that
            bot takes is tagged automatically.
          </p>
        </CardHeader>
        <CardContent>
          <MagicMapManager
            accounts={mapAccounts}
            strategies={activeStrategies.map((s) => ({
              id: s.id,
              name: s.name,
              color: s.color,
            }))}
            rows={mappings}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TextCursorInput className="size-4 text-muted-foreground" aria-hidden="true" />
            Manual trades: comment codes
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            No bot? Write the marker into the MT5 <strong>order comment</strong>{" "}
            field when you open a position:
          </p>
          <code className="w-fit rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
            S:{cards[0]?.code.toLowerCase() ?? "ict-ob"}
          </code>
          <p>
            The marker is matched <strong>case-insensitively</strong> anywhere in
            the comment, so{" "}
            <code className="font-mono text-xs">S:ICT-OB</code>,{" "}
            <code className="font-mono text-xs">s: ict-ob</code> and{" "}
            <code className="font-mono text-xs">breakout S:ICT-OB v2</code> all
            work. Codes must match a strategy code on this page exactly
            (spelling, not case).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StrategiesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading strategies">
      <div className="h-8 w-44 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-36 animate-pulse rounded-xl border bg-muted/40" />
        <div className="h-36 animate-pulse rounded-xl border bg-muted/40" />
      </div>
      <div className="h-56 animate-pulse rounded-xl border bg-muted/40" />
    </div>
  );
}

export default function StrategiesPage() {
  return (
    <Suspense fallback={<StrategiesSkeleton />}>
      <StrategiesContent />
    </Suspense>
  );
}
