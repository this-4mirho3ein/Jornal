import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

/**
 * Branded offline fallback (public/sw.js serves this for failed navigations).
 * Deliberately server-only with no data — it must prerender and work with no
 * network at all. "Try again" is a plain link so even the cached shell stays
 * interactive without hydration.
 */
export default function OfflinePage() {
  return (
    <section className="flex min-h-[70svh] items-center justify-center">
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border bg-muted/50">
          <WifiOff className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          You&rsquo;re offline
        </h1>
        <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          The journal can&rsquo;t reach the server right now. Your data is safe — the
          MT5 EA keeps queueing trades on disk while you&rsquo;re disconnected, and your
          session survives reconnects. This page will pick up trades the moment the
          connection returns.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point */}
          <a href="/" rel="noopener">
            <Button>Try again</Button>
          </a>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Go to the journal
          </Link>
        </div>
      </div>
    </section>
  );
}
