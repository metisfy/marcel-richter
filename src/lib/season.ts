import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { cache } from "react";

import type { Locale } from "@/i18n/routing";

import { type BvvLeague, type BvvMatch, type BvvMatchDetail, parseBvvLeague, parseBvvMatchDetail } from "./bvv";
import { berlinToday, type Fixture, getSeasons, outcomeOf, type Season } from "./content";

/*
 * Saisons mit Live-Daten vom BVV.
 *
 * Seiten, die das hier benutzen (Startseite, Saison, Spieltage), werden beim
 * Build statisch erzeugt und danach höchstens alle fünf Minuten im
 * Hintergrund neu gebaut (Incremental Static Regeneration, `export const
 * revalidate = 300` in der jeweiligen page.tsx). Die Abrufe beim Verband
 * liegen getrennt davon im Fetch-Cache: die Ligaseite höchstens alle zehn
 * Minuten, Spielseiten der letzten Tage alle 15 Minuten, ältere alle sechs
 * Stunden – egal wie viele Besucher kommen.
 *
 * Jeder erfolgreiche Abruf wird als „letzter bekannter Stand“ gespeichert
 * (content/saison/<saison>.bvv.json – im Container und beim Docker-Build;
 * im Repository mit `npm run bvv:stand`). Schlägt ein Abruf fehl, baut die
 * Seite mit diesem Stand („letzter bekannter Stand vom …“) – beim Build wie im
 * Betrieb. So wird jede Seite trotzdem regelmäßig neu erzeugt (z. B. wechselt
 * „Als Nächstes“ nach dem Spieltag auf „Ergebnis folgt“), und neue Daten
 * erscheinen, sobald der Verband wieder antwortet. Nur wenn es gar keinen
 * Stand gibt: beim Build ohne Live-Daten (Hinweis + Link zum BVV), im Betrieb
 * bleibt die letzte Fassung der Seite stehen.
 */

const REVALIDATE_SECONDS = 600;
// Spielseiten der letzten Tage (Spielbericht, Einsätze kommen nach dem Spiel)
const RECENT_MATCH_REVALIDATE_SECONDS = 900;
// Ältere Spielseiten ändern sich kaum noch: seltener abrufen.
const MATCH_REVALIDATE_SECONDS = 6 * 3600;
// Abgeschlossene Saisons im Ergebnis-Archiv ändern sich nicht mehr.
const ARCHIVE_REVALIDATE_SECONDS = 30 * 24 * 3600;

const isArchive = (url: string) => url.includes("/ergebnis-archiv/");

// Rücksicht auf den Server des Verbands: höchstens drei Abrufe gleichzeitig
// (pro Prozess) und dieselbe Adresse nie doppelt parallel – beim Build
// erzeugen mehrere Seiten gleichzeitig dieselben Daten.
const MAX_PARALLEL = 3;
let running = 0;
const queue: (() => void)[] = [];

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((resolve) => queue.push(resolve));
  running += 1;
  try {
    return await task();
  } finally {
    running -= 1;
    queue.shift()?.();
  }
}

type Page = { ok: boolean; status: number; text: string; date: string | null };
const inFlight = new Map<string, Promise<Page>>();

// Sicherung: Ist der Verband nicht erreichbar (Zeitüberschreitung,
// Verbindungsabbruch), versucht es dieser Prozess beim Build gar nicht mehr
// und im Betrieb erst nach einer Minute wieder – sonst wartet jede Seite
// einzeln auf ihre Zeitüberschreitungen und der Build läuft in sein Zeitlimit.
const isBuild = () => process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
let unreachableUntil = 0;
const markUnreachable = () => {
  unreachableUntil = isBuild() ? Number.POSITIVE_INFINITY : Date.now() + 60_000;
};

// Zustand für /api/status – über globalThis, weil jede Route ihre eigene Kopie
// dieses Moduls haben kann.
type BvvStatus = { lastSuccess?: string; lastFailure?: { at: string; message: string } };
const shared = globalThis as unknown as { __bvvStatus?: BvvStatus; __bvvLastGood?: Map<string, Snapshot> };
export const bvvStatus: BvvStatus = (shared.__bvvStatus ??= {});
const lastGood: Map<string, Snapshot> = (shared.__bvvLastGood ??= new Map());

/** Seite beim BVV abrufen – gemeinsam genutzt, begrenzt, mit einem zweiten Versuch bei Abbruch. */
function fetchPage(url: string, revalidate: number): Promise<Page> {
  const pending = inFlight.get(url);
  if (pending) return pending;
  if (process.env.BVV_OFFLINE === "1") return Promise.reject(new Error("BVV_OFFLINE=1"));
  if (Date.now() < unreachableUntil) return Promise.reject(new Error("BVV gerade nicht erreichbar (übersprungen)"));
  const load = async (): Promise<Page> => {
    const response = await fetchBvv(url, revalidate);
    return { ok: response.ok, status: response.status, text: response.ok ? await response.text() : "", date: response.headers.get("date") };
  };
  const promise = limited(async () => {
    try {
      const page = await load();
      if (page.status >= 500) throw new Error(`HTTP ${page.status}`);
      return page;
    } catch {
      await wait(2000);
      try {
        return await load();
      } catch (error) {
        markUnreachable();
        throw error;
      }
    }
  });
  inFlight.set(url, promise);
  promise.then(
    () => setTimeout(() => inFlight.delete(url), 30_000),
    () => inFlight.delete(url),
  );
  return promise;
}

function fetchBvv(url: string, revalidate: number) {
  return fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "de-DE,de;q=0.9",
      "user-agent": "Mozilla/5.0 (compatible; spielplan-abruf/1.0)",
    },
    next: { revalidate, tags: ["bvv"] },
    // Der Verband antwortet unter Last (samstags) teils erst nach über 30 s.
    // Beim Build trotzdem begrenzen: lieber mit dem letzten bekannten Stand
    // bauen (die Seite holt Neues nach dem Start selbst nach) als das
    // Zeitlimit der Pipeline zu reißen. Im Betrieb läuft der Abruf im
    // Hintergrund, Besucher sehen solange die letzte Fassung.
    signal: AbortSignal.timeout(isBuild() ? 60_000 : 90_000),
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchLeague(url: string): Promise<{ league: BvvLeague; updatedAt: string }> {
  const page = await fetchPage(url, isArchive(url) ? ARCHIVE_REVALIDATE_SECONDS : REVALIDATE_SECONDS);
  if (!page.ok) throw new Error(`BVV antwortet mit HTTP ${page.status} (${url})`);
  const league = parseBvvLeague(page.text);
  // Das Date-Header bleibt im Fetch-Cache erhalten und zeigt so, wann die
  // Daten wirklich abgerufen wurden.
  const date = new Date(page.date ?? Date.now());
  return { league, updatedAt: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString() };
}

/** Datum (JJJJ-MM-TT) in deutscher Zeit, `offset` Tage von heute */
const berlinDay = (offset = 0) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(Date.now() + offset * 86_400_000));

async function fetchMatchDetail(url: string, date: string): Promise<BvvMatchDetail | undefined> {
  try {
    const revalidate = isArchive(url)
      ? ARCHIVE_REVALIDATE_SECONDS
      : date.slice(0, 10) >= berlinDay(-3)
        ? RECENT_MATCH_REVALIDATE_SECONDS
        : MATCH_REVALIDATE_SECONDS;
    const page = await fetchPage(url, revalidate);
    return page.ok ? parseBvvMatchDetail(page.text) : undefined;
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
  // Fehlt eine Spielseite (Verband überlastet), gelten ihre Angaben aus dem
  // letzten bekannten Stand – sofern das Spiel dort schon genauso stand.
  const snapshot = readSnapshot(season.id);
  const fromSnapshot = (fixture: Fixture): Fixture | undefined => {
    const known = snapshot?.fixtures.find(
      (entry) => entry.date === fixture.date && entry.teams.join("|") === fixture.teams.join("|") && entry.result?.join(":") === fixture.result?.join(":"),
    );
    return known?.details ? { ...fixture, details: known.details, appearance: known.appearance } : undefined;
  };
  for (let i = 0; i < pending.length; i += 4) {
    const batch = pending.slice(i, i + 4);
    const details = await Promise.all(batch.map(({ fixture }) => fetchMatchDetail(fixture.url!, fixture.date)));
    batch.forEach(({ index }, position) => {
      const detail = details[position];
      if (!detail) {
        fixtures[index] = fromSnapshot(fixtures[index]) ?? fixtures[index];
        return;
      }
      fixtures[index] = applyDetail(fixtures[index], detail, source);
      // Tabellenverlauf: der längste, den eine Spielseite für uns liefert
      const own = detail.ranking.find((entry) => entry.team === source.team)?.positions ?? [];
      if (own.length > ranking.length) ranking = own;
    });
  }

  if (ranking.length === 0 && snapshot) ranking = snapshot.ranking;

  const known = fixtures.filter((fixture) => fixture.appearance);
  // In keinem einzigen Spielbericht: in dieser Saison nicht im Team – dann
  // gar keine Einsatz-Angaben statt „0 von 18“.
  const inSquad = known.some((fixture) => fixture.appearance?.status !== "absent");
  if (!inSquad) {
    return { ...season, fixtures: fixtures.map((fixture) => ({ ...fixture, appearance: undefined })), appearances: undefined, ranking };
  }
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

// ---------------------------------------------------------------------------
// Letzter bekannter Stand (content/saison/<saison>.bvv.json)
// ---------------------------------------------------------------------------

/** Stand der gespeicherten Daten je Saison (für /api/status) */
export function snapshotDates(): Record<string, string | undefined> {
  return Object.fromEntries(getSeasons("de").filter((season) => season.source).map((season) => [season.id, freshest(season.id)?.updatedAt]));
}

type Snapshot = Pick<Season, "fixtures" | "matches" | "table" | "standing" | "record" | "appearances" | "ranking"> & { updatedAt: string };

const snapshotFile = (id: string) => path.join(process.cwd(), "content", "saison", `${id}.bvv.json`);

/** Die BVV-Daten einer Saison zum Ablegen (nur Mannschaften, Ergebnisse, eigene Einsätze – keine Namen anderer Spieler). */
export function toSnapshot(season: Season): Snapshot | undefined {
  if (!season.source?.updatedAt || season.source.error) return undefined;
  const { fixtures, matches, table, standing, record, appearances, ranking } = season;
  return { updatedAt: season.source.updatedAt, fixtures, matches, table, standing, record, appearances, ranking };
}

function readSnapshot(id: string): Snapshot | undefined {
  try {
    return JSON.parse(fs.readFileSync(snapshotFile(id), "utf8")) as Snapshot;
  } catch {
    return undefined;
  }
}

/** Jüngster bekannter Stand: aus diesem Prozess, sonst aus der Datei. */
function freshest(id: string): Snapshot | undefined {
  const memory = lastGood.get(id);
  const file = readSnapshot(id);
  if (!memory) return file;
  if (!file) return memory;
  return memory.updatedAt >= file.updatedAt ? memory : file;
}

const isRuntime = () => process.env.NODE_ENV === "production" && !isBuild();
const written = new Map<string, string>();

/**
 * Erfolgreichen Abruf merken – im Speicher und als Datei, im laufenden
 * Container und beim Docker-Build (BVV_SNAPSHOT_WRITE=1). Lokal (npm run dev,
 * npm run build) bleibt die Datei im Repository unverändert; dafür gibt es
 * `npm run bvv:stand`.
 */
function remember(season: Season) {
  const snapshot = toSnapshot(season);
  if (!snapshot) return;
  lastGood.set(season.id, snapshot);
  bvvStatus.lastSuccess = new Date().toISOString();
  if (!isRuntime() && process.env.BVV_SNAPSHOT_WRITE !== "1") return;
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (written.get(season.id) === json) return;
  try {
    const target = snapshotFile(season.id);
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, json);
    fs.renameSync(temp, target);
    written.set(season.id, json);
  } catch {
    // nicht beschreibbar – dann eben nur im Speicher
  }
}

async function resolve(season: Season): Promise<Season> {
  const { source } = season;
  if (!source) return season;
  try {
    const { league, updatedAt } = await fetchLeague(source.url);
    const resolved = await withDetails(withLeague(season, source, league, updatedAt));
    remember(resolved);
    return resolved;
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}${error.cause ? ` (${String(error.cause)})` : ""}` : String(error);
    bvvStatus.lastFailure = { at: new Date().toISOString(), message: message.slice(0, 300) };
    // Grund unsichtbar in der Seite vermerken (data-bvv-error), damit er sich
    // auch ohne Zugriff auf das Build-Log nachvollziehen lässt.
    const snapshot = freshest(season.id);
    if (snapshot) {
      console.warn(`⚠ Spielplan vom BVV nicht geladen, letzter bekannter Stand vom ${snapshot.updatedAt}: ${message}`);
      const { updatedAt, ...data } = snapshot;
      return { ...season, ...data, source: { ...source, updatedAt, stale: true, error: message.slice(0, 300) } };
    }
    // Im Betrieb ohne jeden Stand: Fehler weiterwerfen, die letzte Fassung der Seite bleibt
    if (isRuntime()) throw error;
    console.warn(`⚠ Spielplan vom BVV nicht geladen, Seite ohne Live-Daten: ${message}`);
    return { ...season, source: { ...source, error: message.slice(0, 300) } };
  }
}

/** Alle Saisons, neueste zuerst; Saisons mit `bvv` mit Live-Daten. */
export const loadSeasons = cache(async (locale: Locale): Promise<Season[]> => Promise.all(getSeasons(locale).map(resolve)));

export async function loadCurrentSeason(locale: Locale): Promise<Season | undefined> {
  return (await loadSeasons(locale))[0];
}

/**
 * Kennung des angezeigten Stands: ändert sich mit neuen Ergebnissen, neuer
 * Tabelle, am nächsten Tag (z. B. „Als Nächstes“ → „Ergebnis folgt“) und mit
 * jedem Deployment. Offene Seiten vergleichen sie mit /api/stand und laden
 * nur dann neu (src/components/auto-refresh.tsx).
 */
export function seasonsVersion(seasons: Season[]): string {
  const data = seasons.map(({ id, fixtures, matches, table, standing, record, appearances, ranking }) => ({
    id,
    fixtures,
    matches,
    table,
    standing,
    record,
    appearances,
    ranking,
  }));
  return createHash("sha1")
    .update(JSON.stringify([process.env.GIT_SHA ?? "dev", berlinToday(), data]))
    .digest("hex")
    .slice(0, 16);
}
