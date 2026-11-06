import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Migration runner — always over standard TCP (node-postgres).
 * On production neon.tech URLs TLS is handled automatically by pg.
 */
async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL (or DATABASE_URL_UNPOOLED) is required to migrate");
  }
  const pool = new Pool({
    connectionString: url,
    ssl:
      url.includes("localhost") || url.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
  });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ migrations applied");
  await pool.end();
}

main().catch((err) => {
  console.error("✗ migration failed:", err);
  process.exit(1);
});
