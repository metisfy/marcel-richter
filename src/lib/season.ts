import "server-only";

import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { cache } from "react";

import type { Locale } from "@/i18n/routing";

import { type BvvLeague, type BvvMatch, parseBvvLeague } from "./bvv";
import { type Fixture, getSeasons, outcomeOf, type Season } from "./content";

/*
 * Saisons mit Live-Daten vom BVV.
 *
 * Seiten, die das hier benutzen (Startseite, Saison), werden beim Build
 * statisch erzeugt und danach höchstens einmal pro Stunde im Hintergrund neu
 * gebaut (Incremental Static Regeneration, `export const revalidate = 3600`
 * in der jeweiligen page.tsx). Die BVV-Seite wird dadurch höchstens einmal
 * pro Stunde abgerufen, egal wie viele Besucher kommen.
 *
 * Schlägt der Abruf fehl:
 * - beim Build: Die Seite wird ohne Live-Daten gebaut (Hinweis + Link zum
 *   BVV) – ein Ausfall beim Verband soll kein Deployment verhindern.
 * - im laufenden Betrieb: Der Fehler wird weitergeworfen. Next.js liefert dann
 *   weiter die letzte gute Fassung der Seite aus und versucht es beim
 *   nächsten Aufruf erneut.
 */

const REVALIDATE_SECONDS = 3600;

async function fetchLeague(url: string): Promise<{ league: BvvLeague; updatedAt: string }> {
  const response = await fetch(url, {
    headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; spielplan-abruf/1.0)" },
    next: { revalidate: REVALIDATE_SECONDS, tags: ["bvv"] },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`BVV antwortet mit HTTP ${response.status} (${url})`);
  const league = parseBvvLeague(await response.text());
  // Das Date-Header bleibt im Fetch-Cache erhalten und zeigt so, wann die
  // Daten wirklich abgerufen wurden.
  const date = new Date(response.headers.get("date") ?? Date.now());
  return { league, updatedAt: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString() };
}

/** Ausrichter eines Spiels; steht er nicht dabei, über das andere Spiel desselben Spieltags. */
function hostOf(match: BvvMatch, sameDay: BvvMatch[]): string | undefined {
  if (match.host) return match.host === "A" ? match.teamA : match.teamB;
  const other = sameDay.find((candidate) => candidate !== match && candidate.host);
  if (!other) return undefined;
  return other.host === "A" ? other.teamA : other.teamB;
}

function withLeague(season: Season, source: { url: string; team: string }, league: BvvLeague, updatedAt: string): Season {
  const { team } = source;
  const own = league.matches.filter((match) => match.teamA === team || match.teamB === team);
  if (own.length === 0) {
    throw new Error(`„${team}“ kommt auf der BVV-Seite nicht vor. Teamname in content/saison/${season.id}.yaml (bvv.team) prüfen.`);
  }

  const fixtures = own.map((match): Fixture => {
    const ownIndex = match.teamA === team ? 0 : 1;
    const sameDay = own.filter((other) => other.date.slice(0, 10) === match.date.slice(0, 10));
    const host = hostOf(match, sameDay);
    return {
      date: match.date,
      number: match.number,
      teams: [match.teamA, match.teamB],
      own: ownIndex,
      opponent: ownIndex === 0 ? match.teamB : match.teamA,
      home: host === team,
      host: host && host !== team ? host : undefined,
      result: match.result,
      sets: match.sets,
      outcome: match.result ? outcomeOf(ownIndex, match.result) : undefined,
    };
  });

  // Bei mehreren Runden (z. B. Haupt- und Platzierungsrunde) gilt die letzte
  // Tabelle, in der die eigene Mannschaft vorkommt.
  const table = league.tables.findLast((rows) => rows.some((row) => row.team === team)) ?? [];
  const row = table.find((entry) => entry.team === team);

  return {
    ...season,
    fixtures,
    table: table.map((entry) => ({ ...entry, own: entry.team === team })),
    standing: row ? { position: row.position, teams: table.length, points: row.points } : season.standing,
    record: row && row.played > 0 ? { played: row.played, won: row.won, lost: row.lost, sets: row.sets, balls: row.balls } : undefined,
    source: { ...source, updatedAt },
  };
}

async function resolve(season: Season): Promise<Season> {
  const { source } = season;
  if (!source) return season;
  try {
    const { league, updatedAt } = await fetchLeague(source.url);
    return withLeague(season, source, league, updatedAt);
  } catch (error) {
    const atRuntime = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD;
    if (atRuntime) throw error;
    console.warn(`⚠ Spielplan vom BVV nicht geladen, Seite ohne Live-Daten: ${error instanceof Error ? error.message : String(error)}`);
    return season;
  }
}

/** Alle Saisons, neueste zuerst; Saisons mit `bvv` mit Live-Daten. */
export const loadSeasons = cache(async (locale: Locale): Promise<Season[]> => Promise.all(getSeasons(locale).map(resolve)));

export async function loadCurrentSeason(locale: Locale): Promise<Season | undefined> {
  return (await loadSeasons(locale))[0];
}
