/**
 * Ingest rate limiting (spec §5.1.3) — 120 requests/min per key, sliding
 * window. Feature-flagged via env (§19): with no Upstash credentials the
 * limiter is skipped (warn logged once), so local dev and CI stay green.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { logWarn } from "@/lib/logger";

const LIMIT_PER_MINUTE = 120;
let cached: Ratelimit | null = null;
let warned = false;

export function isRateLimitConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getLimiter(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!warned) {
      warned = true;
      logWarn("ingest", "rate limit disabled — UPSTASH_REDIS_REST_URL/TOKEN not set");
    }
    return null;
  }
  cached ??= new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(LIMIT_PER_MINUTE, "60 s"),
    prefix: "tj:ingest",
  });
  return cached;
}

export interface RateLimitResult {
  /** True when allowed (or when limiting is not configured). */
  ok: boolean;
  /** Seconds until the window resets — Retry-After on 429. */
  retryAfterSeconds: number | null;
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const limiter = getLimiter();
  if (!limiter) return { ok: true, retryAfterSeconds: null };
  const { success, reset } = await limiter.limit(key);
  return {
    ok: success,
    retryAfterSeconds: success ? null : Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
  };
}
