import { createHash, randomBytes } from "node:crypto";

/**
 * Ingest key format (spec §5.3): `tj_` + 24 hex chars (12 bytes of entropy).
 * The raw key is shown once at creation/rotation; only `hashIngestKey(key)`
 * and `ingestKeyPrefix(key)` are persisted (schema §4.3: `ingest_key_hash`,
 * `ingest_key_prefix` — prefix enables "which key is this?" UI hints).
 */
export const INGEST_KEY_PREFIX_LEN = 6; // hex chars after "tj_"

export function generateIngestKey(): string {
  return `tj_${randomBytes(12).toString("hex")}`;
}

/** SHA-256 hex digest of the raw key — the only value stored in the DB. */
export function hashIngestKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** `tj_` + first 6 chars of the secret — safe to display/log. */
export function ingestKeyPrefix(key: string): string {
  return key.slice(0, 3 + INGEST_KEY_PREFIX_LEN);
}
