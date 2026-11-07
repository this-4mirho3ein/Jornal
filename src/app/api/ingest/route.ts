/**
 * POST /api/ingest — the EA→journal pipeline (spec §5.1, task 05).
 * Steps in this exact order: 64 KB cap → Bearer auth (timing-safe) →
 * rate limit → Zod (versioned) → binding/ownership is enforced inside the
 * idempotent transaction (reducer-db) → realtime publish after commit.
 * Responses: 200 ok / 200 duplicate / 401 / 413 / 422 / 429 / 500 (EA
 * retries on 5xx and network errors, drops on other 4xx — §5.1).
 */
import { createHash, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { tradingAccounts, type TradingAccount } from "@/db/schema";
import { checkRateLimit } from "@/lib/ingest/rate-limit";
import { ingestEventSchema } from "@/lib/ingest/schemas";
import { applyIngestEvent } from "@/lib/ingest/reducer-db";
import { revalidateDashboardCache } from "@/features/dashboard/queries";
import { logError, logInfo } from "@/lib/logger";
import { publishTradeUpdate } from "@/lib/realtime/publish";

// Next 16 + cacheComponents (§2): `runtime` / `dynamic` segment configs are
// disallowed — the route runs on Node.js and stays uncached as a POST
// handler (ADR 0005). maxDuration remains deployment-platform config.
export const maxDuration = 15;

const MAX_BODY_BYTES = 64 * 1024;
const DUMMY_HASH = createHash("sha256").update("tj_dummy_digest").digest("hex");
const SCOPE = "ingest";

function json(body: Record<string, unknown>, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...Object.fromEntries(new Headers(headers)) },
  });
}

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export async function POST(request: Request): Promise<Response> {
  // §5.1.1 — raw body size cap before any parsing.
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: "Payload too large" }, 413);
  }

  // §5.1.2 — Bearer key → SHA-256 → constant-time compare against stored hash.
  const key = extractBearer(request);
  if (!key) return json({ error: "Unauthorized" }, 401);
  const keyHash = createHash("sha256").update(key, "utf8").digest("hex");

  let account: TradingAccount | undefined;
  try {
    [account] = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.ingestKeyHash, keyHash))
      .limit(1);
  } catch (err) {
    logError(SCOPE, "key lookup failed", err);
    return json({ error: "Internal error" }, 500);
  }
  const stored = account?.ingestKeyHash ?? DUMMY_HASH;
  const digestA = Buffer.from(keyHash, "hex");
  const digestB = Buffer.from(stored, "hex");
  if (!account || digestA.length !== digestB.length || !timingSafeEqual(digestA, digestB)) {
    logInfo(SCOPE, "auth rejected", { keyPrefix: key.slice(0, 3) });
    return json({ error: "Unauthorized" }, 401);
  }

  // §5.1.3 — rate limit per key (skipped when Upstash env is absent, §19).
  try {
    const limit = await checkRateLimit(keyHash);
    if (!limit.ok) {
      const headers =
        limit.retryAfterSeconds !== null
          ? { "retry-after": String(limit.retryAfterSeconds) }
          : undefined;
      logInfo(SCOPE, "rate limited", { accountId: account.id });
      return json({ error: "Too many requests" }, 429, headers);
    }
  } catch (err) {
    // Availability over strictness: a limiter outage must not drop events.
    logError(SCOPE, "rate limiter unreachable — allowing request", err, { accountId: account.id });
  }

  // §5.1.4 — Zod, versioned; unknown schemaVersion lands here as 422.
  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    return json({ error: "Invalid JSON" }, 422);
  }
  const parsed = ingestEventSchema.safeParse(payload);
  if (!parsed.success) {
    logInfo(SCOPE, "validation failed", {
      accountId: account.id,
      issues: parsed.error.issues.length,
    });
    return json(
      {
        error: "Invalid event",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      422,
    );
  }
  const event = parsed.data;

  // §5.1.5–7 — binding, idempotency and reduction inside one transaction.
  const now = new Date();
  let result;
  try {
    result = await applyIngestEvent(event, account, now);
  } catch (err) {
    logError(SCOPE, "reduce failed", err, { accountId: account.id, eventId: event.eventId });
    return json({ error: "Internal error" }, 500);
  }

  if (result.duplicate) {
    return json({ duplicate: true }, 200);
  }

  // §5.1.8 / §6.5.1 — realtime publish strictly after the durable commit,
  // fire-and-forget; the toast summary rides on the validated event, so the
  // browser shows "New trade: XAUUSD Buy @ 2321.35" with zero follow-up fetches.
  void publishTradeUpdate({
    userId: account.userId,
    accountId: account.id,
    type: event.type,
    tradeId: result.tradeId,
    trade: event.position
      ? {
          symbol: event.position.symbol,
          direction: event.position.direction,
          price: event.deal?.price ?? null,
          profit: event.deal?.profit ?? null,
        }
      : null,
  });

  // §13 — dashboard/analytics caches revalidate on written data (task 10).
  try {
    revalidateDashboardCache(account.userId, account.id);
  } catch (err) {
    logError(SCOPE, "cache revalidate failed", err, { accountId: account.id });
  }

  logInfo(SCOPE, "event applied", {
    accountId: account.id,
    keyPrefix: account.ingestKeyPrefix,
    type: event.type,
    tradeId: result.tradeId,
  });
  return json({ ok: true, tradeId: result.tradeId }, 200);
}
