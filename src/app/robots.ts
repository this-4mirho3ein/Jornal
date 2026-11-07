import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

/** Public landing indexable; every app + api surface disallowed (§14). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/trades",
        "/analytics",
        "/accounts",
        "/strategies",
        "/settings",
        "/login",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
