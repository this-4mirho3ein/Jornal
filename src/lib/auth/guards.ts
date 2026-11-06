import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";

type SessionInfo = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type SessionUser = SessionInfo["user"];
export type CurrentUser = Pick<SessionUser, "id" | "name" | "email">;

/**
 * Session read for Server Components (pattern from the installed Next.js
 * guide "Authentication with Cache Components"): the scope is private to the
 * browser, so per-session shells can be prefetched; unresolved sessions
 * redirect. Narrow on purpose — only fields the UI may show.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  "use cache: private";

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

/**
 * Hard guard for Server Actions and Route Handlers (spec §15.2).
 * Never cached — always re-reads the session close to the data.
 * The `(app)` layout check alone is never trusted.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session.user;
}
