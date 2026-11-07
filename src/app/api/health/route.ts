import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/**
 * Deploy/monitor healthcheck (§16 step 7): verifies the app boots AND the
 * database is reachable. Returns 503 on failure so Vercel/uptime monitors
 * can alert — response bodies carry no internals. Dynamic under
 * cacheComponents (no "use cache"): every request pings the live DB.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok", db: "up" });
  } catch {
    return Response.json({ status: "error", db: "down" }, { status: 503 });
  }
}
