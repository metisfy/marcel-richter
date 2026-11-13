import "server-only";

import type { Locale } from "@/i18n/routing";

import { getSite } from "./content";
import { seasonCalendar } from "./ical";
import { loadCurrentSeason } from "./season";

/** Antwort für /spielplan.ics bzw. /fixtures.ics */
export async function calendarResponse(locale: Locale, filename: string): Promise<Response> {
  const season = await loadCurrentSeason(locale);
  const site = getSite(locale);
  if (!season) return new Response("Keine Saison", { status: 404 });
  return new Response(seasonCalendar(season, season.source?.team ?? site.team.name, locale), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="${filename}"`,
    },
  });
}
