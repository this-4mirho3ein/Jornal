import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site-url";

/**
 * PWA manifest (§14): installable add-to-home-screen journal. Icons are
 * generated from public/brand/logo.png by scripts/generate-icons.mjs and
 * committed under public/icons/ — 192/512 for "any", plus "maskable" twins
 * (the emblem already sits inside the 80% safe zone). start_url opens the
 * journal; signed-out visitors are redirected to login.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Realtime MT5 Trade Journaling`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
