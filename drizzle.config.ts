import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit reads DATABASE_URL_UNPOOLED (migrations must not hit the pooled
 * Neon endpoint — spec §7); falls back to DATABASE_URL for local dev.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/journal",
  },
  verbose: true,
  strict: true,
});
