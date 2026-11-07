import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db/client";
import { trades, tradingAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guards";
import { STORED_IMAGE_NAME_RE } from "@/lib/storage/constants";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/**
 * GET /api/uploads/<userId>/<tradeId>/<file> — local-driver image streaming.
 * Session-guarded AND ownership-checked against the DB (the key's user
 * segment is convenience, never the authorization).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const user = await requireUser();
  const { key } = await params;
  if (key.length !== 3) return new NextResponse("Not found", { status: 404 });
  const [, tradeId, file] = key;
  if (!/^[0-9a-f-]{36}$/.test(tradeId) || !STORED_IMAGE_NAME_RE.test(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [trade] = await db
    .select({ userId: tradingAccounts.userId })
    .from(trades)
    .innerJoin(tradingAccounts, eq(trades.accountId, tradingAccounts.id))
    .where(and(eq(trades.id, tradeId), eq(tradingAccounts.userId, user.id)))
    .limit(1);
  if (!trade) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readFile(join(process.cwd(), ".uploads", ...key));
    const ext = file.split(".").pop() ?? "png";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
