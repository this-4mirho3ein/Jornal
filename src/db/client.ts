import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { Pool as NodePgPool } from "pg";
import * as schema from "./schema";

/**
 * Database client (spec §7).
 *
 * - Production (Neon): `@neondatabase/serverless` over the pooled URL —
 *   keeps the serverless function from opening TCP connections.
 *   The serverless driver supports transactions (unlike neon-http).
 * - Local dev (Docker Postgres, or any standard TCP Postgres):
 *   `node-postgres`. The Neon driver requires extra WebSocket plumbing
 *   against non-Neon hosts, so we switch automatically by host.
 *
 * Both drizzle wrappers share the same `schema`, so callers are unaware
 * of which driver is in use.
 */

function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Env validation (src/env.js) normally fails first with a clearer error;
    // this guards scripts that bypass t3-env.
    throw new Error("DATABASE_URL is not set — copy .env.example to .env.local");
  }
  if (isNeonUrl(url)) {
    const pool = new NeonPool({ connectionString: url });
    return drizzleNeon(pool, { schema });
  }
  const pool = new NodePgPool({ connectionString: url });
  return drizzleNodePg(pool, { schema });
}

export const db = createDb();
export { schema };
export type Database = ReturnType<typeof createDb>;
