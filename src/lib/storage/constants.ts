/** Storage limits shared by routes, actions and the uploader. */

export const IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

/** Local disk has no function-body limit. */
export const LOCAL_IMAGE_LIMIT_BYTES = 8 * 1024 * 1024;
/**
 * With the Vercel driver the bytes pass through a function body — keep under
 * the platform request cap (~4.5 MB). The client compresses far below this.
 * NOTE (task 09): server-put was verified against the installed @vercel/blob
 * 2.8.2 docs; the presigned client-upload flow is deferred to task 15 where a
 * real Blob store exists to verify against.
 */
export const BLOB_IMAGE_LIMIT_BYTES = 4 * 1024 * 1024;

/** File-name component produced by storage.putTradeImage. */
export const STORED_IMAGE_NAME_RE = /^[a-z0-9]+-[a-f0-9]{16}\.(png|jpg|webp)$/;
