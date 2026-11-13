import "server-only";

import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { cache } from "react";

import type { Locale } from "@/i18n/routing";

import { type BvvLeague, type BvvMatch, type BvvMatchDetail, parseBvvLeague, parseBvvMatchDetail } from "./bvv";
import { type Fixture, getSeasons, outcomeOf, type Season } from "./content";

/*
 * Saisons mit Live-Daten vom BVV.
 *
 * Seiten, die das hier benutzen (Startseite, Saison, Spieltage), werden beim
 * Build statisch erzeugt und danach höchstens einmal pro Stunde im
 * Hintergrund neu gebaut (Incremental Static Regeneration, `export const
 * revalidate = 3600` in der jeweiligen page.tsx). Die Ligaseite wird dadurch
 * höchstens einmal pro Stunde abgerufen, die Spielseiten höchstens alle sechs
 * Stunden – egal wie viele Besucher kommen.
 *
 * Schlägt der Abruf der Ligaseite fehl:
 * - beim Build: Die Seite wird ohne Live-Daten gebaut (Hinweis + Link zum
 *   BVV) – ein Ausfall beim Verband soll kein Deployment verhindern.
 * - im laufenden Betrieb: Der Fehler wird weitergeworfen. Next.js liefert dann
 *   weiter die letzte gute Fassung der Seite aus und versucht es beim
 *   nächsten Aufruf erneut.
 * Fehlt nur eine einzelne Spielseite, fehlen nur deren Angaben.
 */

const REVALIDATE_SECONDS = 3600;
// Spielseiten ändern sich kaum noch (Halle, Spielbericht): seltener abrufen.
const MATCH_REVALIDATE_SECONDS = 6 * 3600;

function fetchBvv(url: string, revalidate: number) {
  return fetch(url, {
    headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; spielplan-abruf/1.0)" },
    next: { revalidate, tags: ["bvv"] },
    signal: AbortSignal.timeout(15_000),
  });
}

async function fetchLeague(url: string): Promise<{ league: BvvLeague; updatedAt: string }> {
  const response = await fetchBvv(url, REVALIDATE_SECONDS);
  if (!response.ok) throw new Error(`BVV antwortet mit HTTP ${response.status} (${url})`);
  const league = parseBvvLeague(await response.text());
  // Das Date-Header bleibt im Fetch-Cache erhalten und zeigt so, wann die
  // Daten wirklich abgerufen wurden.
  const date = new Date(response.headers.get("date") ?? Date.now());
  return { league, updatedAt: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString() };
}

async function fetchMatchDetail(url: string): Promise<BvvMatchDetail | undefined> {
  try {
    const response = await fetchBvv(url, MATCH_REVALIDATE_SECONDS);
    return response.ok ? parseBvvMatchDetail(await response.text()) : undefined;
  } catch {
    return undefined;
  }
}

/** Ausrichter eines Spiels; steht er nicht dabei, über das andere Spiel desselben Spieltags. */
function hostOf(match: BvvMatch, sameDay: BvvMatch[]): string | undefined {
  if (match.host) return match.host === "A" ? match.teamA : match.teamB;
  const other = sameDay.find((candidate) => candidate !== match && candidate.host);
  if (!other) return undefined;
  return other.host === "A" ? other.teamA : other.teamB;
}

function withLeague(season: Season, source: NonNullable<Season["source"]>, league: BvvLeague, updatedAt: string): Season {
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
      url: match.url,
    };
  });

  // Bei mehreren Runden (z. B. Haupt- und Platzierungsrunde) gilt die letzte
  // Tabelle, in der die eigene Mannschaft vorkommt.
  const table = league.tables.findLast((rows) => rows.some((row) => row.team === team)) ?? [];
  const row = table.find((entry) => entry.team === team);

  return {
    ...season,
    fixtures,
    matches: league.matches.map((match) => {
      const sameDay = league.matches.filter((other) => other.date.slice(0, 10) === match.date.slice(0, 10));
      return {
        date: match.date,
        number: match.number,
        teams: [match.teamA, match.teamB],
        host: hostOf(match, sameDay.filter((other) => [other.teamA, other.teamB].some((name) => name === match.teamA || name === match.teamB))),
        result: match.result,
        sets: match.sets,
      };
    }),
    table: table.map((entry) => ({ ...entry, own: entry.team === team })),
    standing: row ? { position: row.position, teams: table.length, points: row.points } : season.standing,
    record: row && row.played > 0 ? { played: row.played, won: row.won, lost: row.lost, sets: row.sets, balls: row.balls } : undefined,
    source: { ...source, updatedAt },
  };
}

const sameName = (a: string, b: string) => a.trim().localeCompare(b.trim(), "de", { sensitivity: "base" }) === 0;

/** Überträgt die Angaben einer Spielseite auf das eigene Spiel. */
function applyDetail(fixture: Fixture, detail: BvvMatchDetail, source: NonNullable<Season["source"]>): Fixture {
  const ballsOf = (name: string) => detail.balls.find((entry) => entry.team === name)?.balls;
  const [ballsA, ballsB] = fixture.teams.map(ballsOf);
  const lineup = detail.lineups.find((entry) => entry.team === source.team);
  const hasReport = Boolean(fixture.result && lineup && lineup.players.length > 0);
  const me = lineup?.players.find(
    (player) => sameName(player.lastName, source.player.lastName) && sameName(player.firstName, source.player.firstName),
  );

  return {
    ...fixture,
    details: {
      referee: detail.referee,
      venue: detail.venue,
      balls: ballsA !== undefined && ballsB !== undefined ? [ballsA, ballsB] : undefined,
      // Nur Anzahlen – Namen anderer Spieler übernimmt die Website nicht.
      squad: hasReport && lineup ? { listed: lineup.players.length, played: lineup.players.filter((player) => player.played).length } : undefined,
    },
    appearance: hasReport ? (me ? { status: me.played ? "played" : "squad", libero: me.libero } : { status: "absent", libero: false }) : undefined,
  };
}

/**
 * Liest die Spielseiten aller gespielten Spiele und des nächsten Spieltags
 * (höchstens vier gleichzeitig): Halle, Schiedsgericht, Bälle, Einsätze,
 * Tabellenverlauf.
 */
async function withDetails(season: Season): Promise<Season> {
  const { source } = season;
  if (!source) return season;
  const nextDay = season.fixtures.find((fixture) => !fixture.result)?.date.slice(0, 10);
  const fixtures = [...season.fixtures];
  const pending = fixtures
    .map((fixture, index) => ({ fixture, index }))
    .filter(({ fixture }) => fixture.url && (fixture.result || fixture.date.startsWith(nextDay ?? "-")));

  let ranking: Season["ranking"] = [];
  for (let i = 0; i < pending.length; i += 4) {
    const batch = pending.slice(i, i + 4);
    const details = await Promise.all(batch.map(({ fixture }) => fetchMatchDetail(fixture.url!)));
    batch.forEach(({ index }, position) => {
      const detail = details[position];
      if (!detail) return;
      fixtures[index] = applyDetail(fixtures[index], detail, source);
      // Tabellenverlauf: der längste, den eine Spielseite für uns liefert
      const own = detail.ranking.find((entry) => entry.team === source.team)?.positions ?? [];
      if (own.length > ranking.length) ranking = own;
    });
  }

  const known = fixtures.filter((fixture) => fixture.appearance);
  const appearances =
    known.length > 0
      ? {
          played: known.filter((fixture) => fixture.appearance?.status === "played").length,
          squad: known.filter((fixture) => fixture.appearance?.status !== "absent").length,
          matches: known.length,
        }
      : undefined;
  return { ...season, fixtures, appearances, ranking };
}

async function resolve(season: Season): Promise<Season> {
  const { source } = season;
  if (!source) return season;
  try {
    const { league, updatedAt } = await fetchLeague(source.url);
    return await withDetails(withLeague(season, source, league, updatedAt));
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
