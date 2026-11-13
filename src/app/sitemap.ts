import type { MetadataRoute } from "next";

import type { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getProjects } from "@/lib/content";
import { localizedUrl } from "@/lib/seo";

type Href = Parameters<typeof getPathname>[0]["href"];

const STATIC_ROUTES = [
  "/",
  "/ueber-mich",
  "/projekte",
  "/saison",
  "/kontakt",
  "/impressum",
  "/datenschutz",
] as const;

function entries(href: Href, lastModified?: string): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(routing.locales.map((locale) => [locale, localizedUrl(locale, href)]));
  return routing.locales.map((locale) => ({
    url: localizedUrl(locale, href),
    lastModified,
    alternates: { languages },
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_ROUTES.flatMap((href) => entries(href)),
    ...getProjects(routing.defaultLocale).flatMap((project) =>
      entries({ pathname: "/projekte/[slug]", params: { slug: project.slug } }, project.date),
    ),
  ];
}
