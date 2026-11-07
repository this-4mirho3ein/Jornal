import { env } from "@/env";

/**
 * Public site identity (spec §14) — single source of truth for metadata,
 * sitemap, robots and the OG image. metadataBase resolves absolute URLs for
 * OG/canonical tags; NEXT_PUBLIC_APP_URL is set in production, the Better
 * Auth URL and localhost cover preview/dev so og-image URLs never go relative.
 */
export const SITE_NAME = "Trading Journal";
export const SITE_TITLE = `${SITE_NAME} — Realtime MetaTrader 5 Trade Journaling`;
export const SITE_DESCRIPTION =
  "Real-time trading journal that syncs every MetaTrader 5 trade automatically — analyze, tag by strategy, and improve your edge.";

export function siteUrl(): URL {
  const raw =
    env.NEXT_PUBLIC_APP_URL ?? env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return new URL(raw);
}
