import "dotenv/config"; // lets `auth` CLI find env when run outside Next

import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { accountsAuth, sessions, users, verifications } from "@/db/schema";
import { db } from "@/db/client";
import { env } from "@/env";
import { isOwnerAllowedToSignUp } from "@/lib/auth/owner-policy";

/**
 * Better Auth instance (spec §2, §15.2) — single-owner email/password auth.
 *
 * Models are mapped onto the §4.3 tables:
 *   user          → users
 *   session       → sessions
 *   account       → accounts_auth (renamed: "accounts" stays a domain concept)
 *   verification  → verifications
 * The drizzle adapter receives an explicit model-name → table map, so no
 * `usePlural` inference is involved.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
  user: { modelName: "users" },
  session: { modelName: "sessions" },
  account: { modelName: "accounts_auth" },
  verification: { modelName: "verifications" },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      users,
      sessions,
      accounts_auth: accountsAuth,
      verifications,
    },
    transaction: true,
  }),
  plugins: [nextCookies()],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const email =
        typeof ctx.body?.email === "string" ? ctx.body.email.toLowerCase() : "";
      const credentialExists = await db
        .select({ id: accountsAuth.id })
        .from(accountsAuth)
        .where(eq(accountsAuth.providerId, "credential"))
        .limit(1);

      const allowed = isOwnerAllowedToSignUp({
        email,
        ownerEmail: env.OWNER_EMAIL,
        ownerAlreadyRegistered: credentialExists.length > 0,
      });
      if (!allowed) {
        // Generic message on purpose (§15.2): no signal about which check failed.
        throw new APIError("FORBIDDEN", { message: "Registration is closed." });
      }
    }),
  },
});
