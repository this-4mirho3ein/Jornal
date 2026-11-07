"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/features/accounts/actions";
import { db } from "@/db/client";
import { strategies, trades, tradingAccounts } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { journalPatchSchema, type JournalStyle } from "@/features/trades/journal-schemas";
import { classifyStyle } from "@/lib/trade-style";

/**
 * §8.2 #6 — debounced journal autosave, one field-batch per call.
 * Absent keys stay untouched; sentinels clear ("" → strategy null / style
 * back to auto-classification / emotion null; 0 → rating null). Picking a
 * style sets `style_source = 'manual'` (§9); clearing re-classifies.
 */
export async function updateTradeJournal(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = journalPatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid journal save." };
  const patch = parsed.data;
  const user = await requireUser();

  const [trade] = await db
    .select({
      id: trades.id,
      status: trades.status,
      openedAt: trades.openedAt,
      closedAt: trades.closedAt,
      durationSeconds: trades.durationSeconds,
      currentStrategyId: trades.strategyId,
      currentStyle: trades.style,
    })
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .where(and(eq(trades.id, patch.tradeId), eq(tradingAccounts.userId, user.id)))
    .limit(1);
  if (!trade) return { ok: false, error: "Trade not found." };

  let nextStrategyId: string | null | undefined;
  if (patch.strategyId !== undefined) {
    if (patch.strategyId === "") {
      nextStrategyId = null;
    } else {
      const [strategy] = await db
        .select({ id: strategies.id })
        .from(strategies)
        .where(and(eq(strategies.id, patch.strategyId), eq(strategies.userId, user.id)))
        .limit(1);
      if (!strategy) return { ok: false, error: "Unknown strategy." };
      nextStrategyId = strategy.id;
    }
  }

  // Style resolution (§9): explicit selection wins and flags manual; the ""
  // sentinel removes the override and recomputes the auto value.
  let nextStyle: JournalStyle | undefined;
  let nextStyleSource: "auto" | "manual" | undefined;
  if (patch.style !== undefined) {
    const effectiveStrategyId = nextStrategyId ?? trade.currentStrategyId;
    if (patch.style === "") {
      nextStyleSource = "auto";
      const [strategy] = effectiveStrategyId
        ? await db
            .select({ defaultStyle: strategies.defaultStyle })
            .from(strategies)
            .where(eq(strategies.id, effectiveStrategyId))
            .limit(1)
        : [];
      if (trade.status === "open") {
        nextStyle = (strategy?.defaultStyle ?? "day") as JournalStyle;
      } else {
        const sameUtcDay =
          trade.openedAt !== null &&
          trade.closedAt !== null &&
          trade.openedAt.toISOString().slice(0, 10) ===
            trade.closedAt.toISOString().slice(0, 10);
        const classified = classifyStyle({
          durationSeconds: trade.durationSeconds ?? 0,
          closedSameTradingDay: sameUtcDay,
        });
        nextStyle = (classified ?? "day") as JournalStyle;
      }
    } else {
      nextStyle = patch.style;
      nextStyleSource = "manual";
    }
  }

  await db
    .update(trades)
    .set({
      ...(nextStrategyId !== undefined ? { strategyId: nextStrategyId } : {}),
      ...(nextStyle !== undefined ? { style: nextStyle } : {}),
      ...(nextStyleSource !== undefined ? { styleSource: nextStyleSource } : {}),
      ...(patch.rating !== undefined ? { rating: patch.rating === 0 ? null : patch.rating } : {}),
      ...(patch.emotion !== undefined
        ? { emotion: patch.emotion === "" ? null : patch.emotion }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.setupTags !== undefined ? { setupTags: patch.setupTags } : {}),
      ...(patch.mistakeTags !== undefined ? { mistakeTags: patch.mistakeTags } : {}),
    })
    .where(eq(trades.id, trade.id));

  revalidatePath(`/trades/${patch.tradeId}`);
  revalidatePath("/trades");
  return { ok: true, data: null };
}
