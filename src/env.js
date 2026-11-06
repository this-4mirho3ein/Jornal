import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Type-safe environment variables (spec §15.1).
 * Grows with each phase — every new integration adds its vars here so the
 * app fails fast at boot when misconfigured. Secrets never leak to the client.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
    /** Pooled Neon URL — runtime queries (spec §7). */
    DATABASE_URL: z.string().min(1),
    /** Unpooled Neon URL — migrations only. Falls back to DATABASE_URL locally. */
    DATABASE_URL_UNPOOLED: z.string().optional(),
    /** Better Auth secret (spec §15.2) — required from phase 3 on. */
    BETTER_AUTH_SECRET: z.string().min(16),
    /** Public base URL — Better Auth trusted origin and callback base. */
    BETTER_AUTH_URL: z.url(),
    /** Single-owner allowlist: registration closes once this email is registered. */
    OWNER_EMAIL: z.email(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
