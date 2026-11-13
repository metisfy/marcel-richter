import type { Locale } from "@/i18n/routing";

import type { Fixture, Project, Season, Site } from "./content";
import { toIsoBerlin } from "./format";
import { localizedUrl } from "./seo";
import { absoluteUrl, SITE_URL } from "./site-url";

/*
 * Strukturierte Daten (schema.org, JSON-LD). Person, Verein und Website
 * hängen über feste @id-Werte zusammen, damit Suchmaschinen sie als
 * zusammengehörigen Graphen erkennen.
 */

export const PERSON_ID = `${SITE_URL}/#person`;
export const TEAM_ID = `${SITE_URL}/#team`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

type JsonLd = Record<string, unknown>;

export function siteGraph(site: Site, locale: Locale): JsonLd {
  const person: JsonLd = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: site.name,
    url: localizedUrl(locale, "/"),
    image: absoluteUrl(site.portrait),
    jobTitle: site.jobTitle,
    description: site.tagline,
    email: `mailto:${site.email}`,
    sameAs: site.socials.map((social) => social.url),
    memberOf: { "@id": TEAM_ID },
    ...(site.location
      ? { homeLocation: { "@type": "Place", name: site.location } }
      : {}),
  };

  const team: JsonLd = {
    "@type": "SportsTeam",
    "@id": TEAM_ID,
    name: site.team.name,
    sport: site.team.sport,
    ...(site.team.url ? { url: site.team.url } : {}),
    ...(site.team.logo ? { logo: absoluteUrl(site.team.logo) } : {}),
    ...(site.team.league
      ? { memberOf: { "@type": "SportsOrganization", name: site.team.league } }
      : {}),
    athlete: { "@id": PERSON_ID },
  };

  const website: JsonLd = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: site.name,
    inLanguage: locale,
    publisher: { "@id": PERSON_ID },
    about: { "@id": PERSON_ID },
    ...(site.copyright.length > 0
      ? {
          copyrightHolder: site.copyright.map((holder) => ({
            "@type": "Organization",
            name: holder.label,
            ...(holder.url ? { url: holder.url } : {}),
          })),
        }
      : {}),
  };

  return { "@context": "https://schema.org", "@graph": [person, team, website] };
}

export function seasonEvents(site: Site, season: Season, locale: Locale): JsonLd {
  const own = { "@type": "SportsTeam", "@id": TEAM_ID, name: site.team.name };
  const event = (fixture: Fixture): JsonLd => {
    const opponent = { "@type": "SportsTeam", name: fixture.opponent };
    const competitors = fixture.own === 0 ? [own, opponent] : [opponent, own];
    // homeTeam/awayTeam nur, wenn eine der beiden Mannschaften wirklich zu
    // Hause spielt – bei Spieltagen mit drei Teams ist das oft keine.
    const host = fixture.home ? site.team.name : fixture.host;
    const homeIndex = host === undefined ? -1 : fixture.teams.indexOf(host);
    return {
      "@type": "SportsEvent",
      name: fixture.teams.join(" – "),
      startDate: toIsoBerlin(fixture.date),
      sport: site.team.sport,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      competitor: competitors,
      ...(homeIndex >= 0 ? { homeTeam: competitors[homeIndex], awayTeam: competitors[1 - homeIndex] } : {}),
      location: {
        "@type": "Place",
        name: fixture.venue ?? host ?? fixture.opponent,
      },
      ...(fixture.competition ? { superEvent: { "@type": "SportsEvent", name: fixture.competition } } : {}),
      url: localizedUrl(locale, "/saison"),
    };
  };

  return {
    "@context": "https://schema.org",
    "@graph": season.fixtures.map(event),
  };
}

export function projectGraph(project: Project, locale: Locale, labels: { home: string; projects: string }): JsonLd {
  const url = localizedUrl(locale, { pathname: "/projekte/[slug]", params: { slug: project.slug } });
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": `${url}#project`,
        name: project.title,
        headline: project.title,
        description: project.summary,
        url,
        image: absoluteUrl(project.cover),
        dateCreated: project.date,
        inLanguage: project.contentLocale,
        keywords: project.tags.join(", "),
        creator: { "@id": PERSON_ID },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: labels.home, item: localizedUrl(locale, "/") },
          { "@type": "ListItem", position: 2, name: labels.projects, item: localizedUrl(locale, "/projekte") },
          { "@type": "ListItem", position: 3, name: project.title, item: url },
        ],
      },
    ],
  };
}
