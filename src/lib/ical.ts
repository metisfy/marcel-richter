import "server-only";

import type { Locale } from "@/i18n/routing";

import type { Season } from "./content";
import { formatTime, toIsoBerlin } from "./format";
import { getMatchday, matchdayDates, matchStats } from "./matchday";
import { localizedUrl } from "./seo";

/*
 * Spielplan als Kalender-Abo (iCalendar, RFC 5545): ein Termin pro Spieltag.
 * Kalender-Apps fragen die Datei regelmäßig neu ab, Verschiebungen und
 * Ergebnisse kommen so automatisch an. Ausgeliefert unter /spielplan.ics
 * (Deutsch) und /fixtures.ics (Englisch).
 */

const DURATION_HOURS = 4; // Spieltag mit drei Mannschaften, drei Spielen

/** Text für iCalendar maskieren (\ ; , und Zeilenumbrüche) */
const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Zeilen nach 75 Bytes falten (Folgezeilen beginnen mit einem Leerzeichen) */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    // nicht mitten in einem UTF-8-Zeichen trennen
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return parts.join("\r\n ");
}

const utc = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function seasonCalendar(season: Season, teamName: string, locale: Locale): string {
  const de = locale === "de";
  const now = utc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marcel Richter//Spielplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(`${teamName} – ${de ? "Spielplan" : "Fixtures"} ${season.season}`)}`,
    `X-WR-CALDESC:${escape(`${season.league}${de ? ", Daten vom Bayerischen Volleyball-Verband" : ", data from the Bavarian Volleyball Association"}`)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const date of matchdayDates(season)) {
    const day = getMatchday(season, date);
    if (!day) continue;
    const first = day.fixtures[0];
    const where = day.home ? (de ? "Heimspieltag" : "home matchday") : day.host ? `${de ? "Spieltag bei" : "matchday at"} ${day.host}` : de ? "Spieltag" : "matchday";
    const results = day.fixtures.map((fixture) => matchStats(fixture)).filter(Boolean);
    const wins = results.filter((entry) => entry!.result[0] > entry!.result[1]).length;
    const summary =
      results.length === day.fixtures.length
        ? `🏐 ${teamName}: ${where} – ${wins}/${results.length} ${de ? (wins === 1 ? "Sieg" : "Siege") : wins === 1 ? "win" : "wins"}`
        : `🏐 ${teamName}: ${where}`;

    const description = [
      ...day.fixtures.map((fixture) => {
        const time = formatTime(fixture.date, locale);
        const score = fixture.result ? ` ${fixture.result.join(":")}${fixture.sets.length ? ` (${fixture.sets.join(", ")})` : ""}` : time ? ` · ${time}` : "";
        return `${fixture.teams.join(" – ")}${score}`;
      }),
      "",
      localizedUrl(locale, { pathname: "/saison/[datum]", params: { datum: date } }),
    ].join("\n");

    const location = day.venue
      ? [day.venue.name, day.venue.street, day.venue.city].filter(Boolean).join(", ")
      : day.home
        ? teamName
        : day.host;

    lines.push("BEGIN:VEVENT", `UID:spieltag-${date}-${teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@marcel-richter`, `DTSTAMP:${now}`);
    if (first.date.length > 10) {
      const start = new Date(toIsoBerlin(first.date));
      lines.push(`DTSTART:${utc(start)}`, `DTEND:${utc(new Date(start.getTime() + DURATION_HOURS * 3600_000))}`);
    } else {
      const next = new Date(`${date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`);
    }
    lines.push(`SUMMARY:${escape(summary)}`, `DESCRIPTION:${escape(description)}`);
    if (location) lines.push(`LOCATION:${escape(location)}`);
    if (day.venue?.lat !== undefined && day.venue.lng !== undefined) lines.push(`GEO:${day.venue.lat};${day.venue.lng}`);
    lines.push(`URL:${localizedUrl(locale, { pathname: "/saison/[datum]", params: { datum: date } })}`, "STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
