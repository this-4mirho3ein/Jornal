import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { del as blobDelete, put as blobPut } from "@vercel/blob";

import {
  BLOB_IMAGE_LIMIT_BYTES,
  IMAGE_CONTENT_TYPES,
  LOCAL_IMAGE_LIMIT_BYTES,
  type ImageContentType,
} from "@/lib/storage/constants";

export { BLOB_IMAGE_LIMIT_BYTES, IMAGE_CONTENT_TYPES, LOCAL_IMAGE_LIMIT_BYTES };
export type { ImageContentType };

export type ImageDriver = "local" | "vercel";

/** Vercel Blob when its token exists; local disk under `.uploads/` otherwise. */
export function imageDriver(): ImageDriver {
  return process.env.BLOB_READ_WRITE_TOKEN ? "vercel" : "local";
}

export function imageLimitBytes(driver: ImageDriver): number {
  return driver === "vercel" ? BLOB_IMAGE_LIMIT_BYTES : LOCAL_IMAGE_LIMIT_BYTES;
}

export function isAllowedImageContentType(value: string): value is ImageContentType {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

function safeExtension(contentType: ImageContentType): string {
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
}

export interface PutTradeImageParams {
  userId: string;
  tradeId: string;
  bytes: Buffer;
  contentType: ImageContentType;
}

export interface StoredTradeImage {
  /** Browser-facing URL. Local driver → app route; vercel → CDN URL. */
  url: string;
  /** Storage key (`.uploads/`-relative or Blob pathname). */
  pathname: string;
  sizeBytes: number;
  driver: ImageDriver;
}

const uploadRoot = (): string => join(process.cwd(), ".uploads");

export async function putTradeImage(params: PutTradeImageParams): Promise<StoredTradeImage> {
  const driver = imageDriver();
  const base = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${safeExtension(params.contentType)}`;

  if (driver === "vercel") {
    const blob = await blobPut(`trades/${params.tradeId}/${base}`, params.bytes, {
      access: "public",
      contentType: params.contentType,
      addRandomSuffix: false,
    });
    return {
      url: blob.url,
      pathname: blob.pathname,
      sizeBytes: params.bytes.byteLength,
      driver,
    };
  }

  const pathname = `${params.userId}/${params.tradeId}/${base}`;
  await mkdir(join(uploadRoot(), params.userId, params.tradeId), { recursive: true });
  await writeFile(join(uploadRoot(), pathname), params.bytes);
  return {
    url: `/api/uploads/${pathname}`,
    pathname,
    sizeBytes: params.bytes.byteLength,
    driver,
  };
}

/** Removes the stored bytes for a deleted row (idempotent). */
export async function deleteStoredImage(image: {
  blobUrl: string;
  blobPathname: string;
}): Promise<void> {
  if (image.blobUrl.startsWith("/api/uploads/")) {
    await unlink(join(uploadRoot(), image.blobPathname)).catch(() => {});
    return;
  }
  await blobDelete(image.blobUrl).catch(() => {});
}
