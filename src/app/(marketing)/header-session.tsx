import { headers } from "next/headers";
import Link from "next/link";
import { CircleUserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/server";

/** Unauthenticated header actions — also the streaming fallback below (§14). */
export function HeaderAuthActions() {
  return (
    <>
      {/* Hidden on the narrowest screens (the landing hero + footer keep the
          sign-up path) so the three-zone header never collides there. */}
      <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
        <a href="/login">Sign in</a>
      </Button>
      <Button asChild size="sm">
        <a href="/register">Get started</a>
      </Button>
    </>
  );
}

/**
 * Session-aware header slot for the marketing pages (owner request, 2026-11):
 * signed-out visitors keep "Sign in / Get started"; signed-in users get a
 * profile chip that leads to the journal. Reads the session directly (not
 * `getCurrentUser`, which redirects) so the marketing shell stays valid for
 * both states; under cacheComponents it renders as a dynamic hole inside the
 * layout's Suspense boundary — the static shell always contains the fallback.
 */
export default async function HeaderSession() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) return <HeaderAuthActions />;

  return (
    <Button
      asChild
      variant="outline"
      className="size-8 rounded-full p-0"
      title="Your journal — open the dashboard"
    >
      <Link href="/dashboard" aria-label="Your journal — open the dashboard">
        <CircleUserRound className="size-4" aria-hidden="true" />
      </Link>
    </Button>
  );
}
