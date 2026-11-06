import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  generateIngestKey,
  hashIngestKey,
  ingestKeyPrefix,
  INGEST_KEY_PREFIX_LEN,
} from "@/features/accounts/key";

describe("ingest keys (spec §5.3)", () => {
  it("matches the tj_<24hex> format", () => {
    const key = generateIngestKey();
    expect(key).toMatch(/^tj_[0-9a-f]{24}$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateIngestKey()));
    expect(keys.size).toBe(200);
  });

  it("hashes deterministically as SHA-256 hex", () => {
    const key = "tj_0123456789abcdef01234567";
    const expected = createHash("sha256").update(key, "utf8").digest("hex");
    expect(hashIngestKey(key)).toBe(expected);
    expect(hashIngestKey(key)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIngestKey(key)).toBe(hashIngestKey(`${key}`));
    expect(hashIngestKey(`${key}x`)).not.toBe(expected);
  });

  it("keeps a short displayable prefix off the secret", () => {
    const key = generateIngestKey();
    const prefix = ingestKeyPrefix(key);
    expect(prefix).toBe(key.slice(0, 3 + INGEST_KEY_PREFIX_LEN));
    expect(prefix).toMatch(/^tj_[0-9a-f]{6}$/);
    expect(prefix.length).toBeLessThan(key.length);
    expect(prefix).not.toBe(key);
  });
});
