import { Suspense } from "react";

import { TradeDetailSections } from "@/app/(app)/trades/[id]/trade-detail";
import { TradeSheet } from "@/app/(app)/trades/[id]/trade-sheet";

/**
 * §8.2 — intercepting side sheet: clicking a trade row in /trades opens the
 * detail here; direct URLs still get /trades/[id] as a deep-linkable page.
 * Instant-navigation rule: this segment renders SYNCHRONOUSLY — the params
 * promise is awaited only inside the Suspense boundary below, never here.
 */
export default function InterceptedTradeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <TradeSheet>
      <Suspense
        fallback={
          <div className="flex flex-col gap-3" aria-busy="true">
            <div className="h-8 w-56 animate-pulse rounded bg-muted" />
            <div className="h-40 animate-pulse rounded-xl bg-muted" />
          </div>
        }
      >
        <InterceptedBody params={params} />
      </Suspense>
    </TradeSheet>
  );
}

async function InterceptedBody({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TradeDetailSections tradeId={id} />;
}
