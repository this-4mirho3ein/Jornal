/**
 * One-time owner credential claim (spec §15.2): registers OWNER_EMAIL with
 * the OWNER_PASSWORD from .env.local, before seeding — so the seed attaches
 * demo data to the real owner instead of an uncredentialed placeholder row.
 *
 * Uses auth.api.signUpEmail directly (no dev server needed); the owner
 * sign-up hook in lib/auth/server permits exactly this row: owner email and
 * no existing credential. Re-running is a safe no-op (§0.8). The DB stores
 * only the password hash — the plaintext lives solely in .env.local (local,
 * gitignored) and this process's memory.
 */
import { eq } from "drizzle-orm";

import "@/lib/load-env";

import { db } from "@/db/client";
import { accountsAuth, users } from "@/db/schema";
import { auth } from "@/lib/auth/server";

async function main(): Promise<void> {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "OWNER_EMAIL and OWNER_PASSWORD are required — set OWNER_PASSWORD in .env.local",
    );
  }
  if (password.length < 8) {
    throw new Error("OWNER_PASSWORD must be at least 8 characters");
  }

  try {
    const existing = await db
      .select({ id: accountsAuth.id })
      .from(accountsAuth)
      .where(eq(accountsAuth.providerId, "credential"))
      .limit(1);
    if (existing.length > 0) {
      console.log("= owner credential already exists — nothing to claim");
      return;
    }

    await auth.api.signUpEmail({
      body: { email, password, name: "Journal Owner" },
    });

    const [claimed] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    if (!claimed) {
      throw new Error("sign-up returned but the owner user row is missing");
    }
    console.log(
      `✓ owner credential claimed for ${claimed.email} (user ${claimed.id}) — hash stored, plaintext never persisted`,
    );
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error("✗ owner claim failed:", err);
  process.exit(1);
});
