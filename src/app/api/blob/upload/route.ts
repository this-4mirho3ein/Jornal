import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db/client";
import { tradeImages } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import {
  imageDriver,
  imageLimitBytes,
  isAllowedImageContentType,
  putTradeImage,
} from "@/lib/storage/storage";
import { ownsTrade } from "@/features/journal-images/queries";
import { registerImageFormSchema } from "@/features/journal-images/schemas";

/**
 * POST /api/blob/upload — screenshot ingest (spec §8.2 #3, §15).
 * Validates session, trade ownership, content type and the driver's size
 * cap; stores bytes (local driver or Vercel Blob) and registers the row.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const parsed = registerImageFormSchema.safeParse({
    tradeId: form.get("tradeId") ?? undefined,
    caption: form.get("caption") ?? undefined,
    kind: form.get("kind") ?? undefined,
    width: form.get("width") ?? undefined,
    height: form.get("height") ?? undefined,
    blurDataUrl: form.get("blurDataUrl") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload fields" }, { status: 400 });
  }
  const { tradeId, caption, kind, width, height, blurDataUrl } = parsed.data;

  if (!(await ownsTrade(user.id, tradeId))) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!isAllowedImageContentType(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG or WebP images are allowed" },
      { status: 415 },
    );
  }
  const driver = imageDriver();
  if (file.size === 0 || file.size > imageLimitBytes(driver)) {
    return NextResponse.json(
      { error: `Image must be between 1 byte and ${Math.round(imageLimitBytes(driver) / 1024 / 1024)} MB` },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await putTradeImage({
    userId: user.id,
    tradeId,
    bytes,
    contentType: file.type,
  });

  const [image] = await db
    .insert(tradeImages)
    .values({
      tradeId,
      blobUrl: stored.url,
      blobPathname: stored.pathname,
      caption: caption ?? null,
      kind: kind ?? "other",
      width: width ?? null,
      height: height ?? null,
      sizeBytes: stored.sizeBytes,
      blurDataUrl: blurDataUrl ?? null,
    })
    .returning();

  return NextResponse.json(
    {
      image: {
        id: image.id,
        tradeId: image.tradeId,
        url: image.blobUrl,
        pathname: image.blobPathname,
        caption: image.caption,
        kind: image.kind,
        width: image.width,
        height: image.height,
        sizeBytes: image.sizeBytes,
        blurDataUrl: image.blurDataUrl,
        sortOrder: image.sortOrder,
      },
    },
    { status: 201 },
  );
}
