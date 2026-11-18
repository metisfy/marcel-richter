import type { MetadataRoute } from "next";

import type { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { berlinToday, getProjects } from "@/lib/content";
import { matchdayDates } from "@/lib/matchday";
import { loadSeasons } from "@/lib/season";
import { localizedUrl } from "@/lib/seo";
import { projectVisible } from "@/lib/website-settings";

type Href = Parameters<typeof getPathname>[0]["href"];

// Stündlich neu: neue Spieltage und Ergebnisse erscheinen ohne Deployment
export const revalidate = 3600;

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seasons = await loadSeasons(routing.defaultLocale);
  return [
    ...STATIC_ROUTES.flatMap((href) => entries(href, href === "/" || href === "/saison" ? seasons[0]?.source?.updatedAt : undefined)),
    ...getProjects(routing.defaultLocale)
      .filter((project) => projectVisible(project.slug))
      .flatMap((project) =>
      entries({ pathname: "/projekte/[slug]", params: { slug: project.slug } }, project.date),
    ),
    // Spieltage; gespielte mit dem Datum des Spieltags, kommende mit dem Stand der Daten
    ...[...new Set(seasons.flatMap(matchdayDates))].flatMap((datum) =>
      entries(
        { pathname: "/saison/[datum]", params: { datum } },
        datum <= berlinToday() ? datum : seasons[0]?.source?.updatedAt,
      ),
    ),
  ];
}
