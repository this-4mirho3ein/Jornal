"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/features/accounts/actions";
import { db } from "@/db/client";
import { tradeImages } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { deleteStoredImage } from "@/lib/storage/storage";
import {
  deleteTradeImageSchema,
  reorderTradeImagesSchema,
  updateTradeImageSchema,
} from "@/features/journal-images/schemas";
import { getOwnedTradeImage, ownsTrade } from "@/features/journal-images/queries";

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Caption / kind edit — owner-only (spec §8.2 #3). */
export async function updateTradeImage(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = updateTradeImageSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid image update.");
  const user = await requireUser();
  const owned = await getOwnedTradeImage(user.id, parsed.data.imageId);
  if (!owned) return fail("Image not found.");

  await db
    .update(tradeImages)
    .set({
      ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
      ...(parsed.data.kind !== undefined ? { kind: parsed.data.kind } : {}),
    })
    .where(eq(tradeImages.id, parsed.data.imageId));

  revalidatePath(`/trades/${owned.image.tradeId}`);
  return { ok: true, data: null };
}

/** Deletes the row AND the stored bytes (local or Blob), owner-only. */
export async function deleteTradeImage(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = deleteTradeImageSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid image delete.");
  const user = await requireUser();
  const owned = await getOwnedTradeImage(user.id, parsed.data.imageId);
  if (!owned) return fail("Image not found.");

  await db.delete(tradeImages).where(eq(tradeImages.id, owned.image.id));
  await deleteStoredImage(owned.image);
  revalidatePath(`/trades/${owned.image.tradeId}`);
  return { ok: true, data: null };
}

/** Persists a manual gallery order (drag & drop), owner-only. */
export async function reorderTradeImages(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = reorderTradeImagesSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid image order.");
  const { tradeId, orderedIds } = parsed.data;
  const user = await requireUser();
  if (!(await ownsTrade(user.id, tradeId))) return fail("Trade not found.");

  await db.transaction(async (tx) => {
    for (const [index, imageId] of orderedIds.entries()) {
      await tx
        .update(tradeImages)
        .set({ sortOrder: index })
        .where(and(eq(tradeImages.id, imageId), eq(tradeImages.tradeId, tradeId)));
    }
  });
  revalidatePath(`/trades/${tradeId}`);
  return { ok: true, data: null };
}
