import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { tradeImages, trades, tradingAccounts } from "@/db/schema";

export interface TradeImageRow {
  id: string;
  tradeId: string;
  url: string;
  pathname: string;
  caption: string | null;
  kind: "entry" | "exit" | "htf" | "other";
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  blurDataUrl: string | null;
  sortOrder: number;
}

function toRow(row: typeof tradeImages.$inferSelect): TradeImageRow {
  return {
    id: row.id,
    tradeId: row.tradeId,
    url: row.blobUrl,
    pathname: row.blobPathname,
    caption: row.caption,
    kind: row.kind,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    blurDataUrl: row.blurDataUrl,
    sortOrder: row.sortOrder,
  };
}

/** Ownership-checked image list for one trade (gallery order). */
export async function getTradeImages(
  userId: string,
  tradeId: string,
): Promise<TradeImageRow[]> {
  const rows = await db
    .select({ image: tradeImages })
    .from(tradeImages)
    .innerJoin(trades, eq(tradeImages.tradeId, trades.id))
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .where(and(eq(tradeImages.tradeId, tradeId), eq(tradingAccounts.userId, userId)))
    .orderBy(asc(tradeImages.sortOrder), asc(tradeImages.createdAt));
  return rows.map((row) => toRow(row.image));
}

/** Trade-image row joined with its owner, or null (missing/other user's). */
export async function getOwnedTradeImage(userId: string, imageId: string) {
  const [row] = await db
    .select({ image: tradeImages, userId: tradingAccounts.userId })
    .from(tradeImages)
    .innerJoin(trades, eq(tradeImages.tradeId, trades.id))
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .where(and(eq(tradeImages.id, imageId), eq(tradingAccounts.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** True when the user owns the trade (upload/delete/reorder gate). */
export async function ownsTrade(userId: string, tradeId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: tradingAccounts.userId })
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .where(and(eq(trades.id, tradeId), eq(tradingAccounts.userId, userId)))
    .limit(1);
  return Boolean(row);
}
