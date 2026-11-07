import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

/** Sitemap covers public routes only (§14) — the app itself is noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl().toString(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
