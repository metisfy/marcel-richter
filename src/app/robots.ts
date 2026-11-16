import type { MetadataRoute } from "next";

import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  // Ohne eigene Domain (GitHub-Variable SITE_URL) nichts indexieren lassen –
  // sonst zeigten Canonical-Links und Sitemap auf localhost.
  if (!SITE_URL_CONFIGURED) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
