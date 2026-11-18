import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { hostFrom, isAdminHost } from "@/lib/admin/hosts";
import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";
import { websiteSettings } from "@/lib/website-settings";

// Bei jedem Abruf neu: Der Schalter „Suchmaschinen“ im Admin-Bereich wirkt sofort
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = hostFrom(await headers());
  // Admin-Host, lokale Entwicklung oder Schalter aus: nichts indexieren
  if (isAdminHost(host) || !SITE_URL_CONFIGURED || !websiteSettings().indexing) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
