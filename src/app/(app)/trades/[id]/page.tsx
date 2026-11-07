import { Suspense } from "react";

import { TradeDetailSections } from "@/app/(app)/trades/[id]/trade-detail";

export const metadata = { title: "Trade" };

/** Deep-linkable full trade page (the side sheet intercepts from /trades). */
export default function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <TradeDetailSectionsWrapper params={params} />
    </Suspense>
  );
}

async function TradeDetailSectionsWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TradeDetailSections tradeId={id} />;
}
