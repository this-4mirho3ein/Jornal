import { Suspense } from "react";

import { TradeDetailSections } from "@/app/(app)/trades/[id]/trade-detail";
import { TradeSheet } from "@/app/(app)/trades/[id]/trade-sheet";

// The overlay renders through the client drawer immediately, but its visible
// output lives in a client-hosted subtree, so instant-nav validation cannot
// attribute it to this segment. Opt this one segment out; navigation falls
// back to the classic server render for the sheet, which still opens on click.
export const instant = false;

/**
 * §8.2 — intercepting side sheet: clicking a trade row in /trades opens the
 * detail here; direct URLs still get /trades/[id] as a deep-linkable page.
 * The params promise is awaited only inside the Suspense boundary below.
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
