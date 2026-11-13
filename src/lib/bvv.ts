/*
 * Spielplan, Ergebnisse und Tabelle vom Bayerischen Volleyball-Verband (BVV).
 *
 * Quelle ist die öffentliche Ligaseite auf volleyball.bayern, z. B.
 *   https://volleyball.bayern/ergebnisse/erwachsene/schwaben/wettbewerb-44600
 * Sie enthält die Tabelle „Alle Spiele“ (Datum, Nr., Team A, Team B,
 * Ergebnis, Sätze) und die Ligatabelle. „(H)“ hinter einem Team heißt: Dieses
 * Team richtet den Spieltag aus.
 *
 * Der BVV hat für Vereine zusätzlich eine Schnittstelle mit API-Key. Den Key
 * kann nur die Abteilungsleitung im BVV-Portal anlegen; solange es ihn nicht
 * gibt, lesen wir die öffentliche Seite. Ändert der BVV deren Aufbau, findet
 * der Parser keine Spiele mehr und wirft einen Fehler – die Website zeigt dann
 * weiter den letzten erfolgreich geladenen Stand (siehe src/lib/season.ts).
 *
 * Diese Datei hat bewusst keine Abhängigkeiten (auch kein „server-only“),
 * damit sich der Parser ohne Next.js mit einer gespeicherten Seite prüfen lässt.
 */

export type BvvMatch = {
  number?: number;
  /** "JJJJ-MM-TT HH:MM", deutsche Ortszeit */
  date: string;
  teamA: string;
  teamB: string;
  /** Welches Team den Spieltag ausrichtet, falls auf der Seite markiert */
  host?: "A" | "B";
  /** Sätze in der Reihenfolge Team A : Team B */
  result?: [number, number];
  /** Einzelne Sätze aus Sicht von Team A, z. B. ["25:21", "22:25"] */
  sets: string[];
};

export type BvvTableRow = {
  position: number;
  team: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  /** z. B. "8:8" */
  sets: string;
  /** z. B. "344:347" */
  balls: string;
};

export type BvvLeague = {
  matches: BvvMatch[];
  /** Alle Tabellen der Seite (bei mehreren Runden mehrere), in Seitenreihenfolge */
  tables: BvvTableRow[][];
};

// ---------------------------------------------------------------------------
// HTML-Helfer (die Seite ist serverseitig gerendertes, regelmäßiges HTML)
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function text(html: string): string {
  return decode(html.replace(/<svg\b[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tablesOf(html: string): string[] {
  return html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
}

function rowsOf(html: string): string[] {
  return html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
}

function cellsOf(row: string): string[] {
  return [...row.matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
}

function section(table: string, tag: "thead" | "tbody"): string {
  return new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(table)?.[1] ?? "";
}

/** Spaltenköpfe der letzten Kopfzeile (bei zweizeiligen Köpfen die untere). */
function headerOf(table: string): string[] {
  const rows = rowsOf(section(table, "thead"));
  const last = rows.at(-1);
  return last ? cellsOf(last).map(text) : [];
}

const toInt = (value: string) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : 0;
};

// ---------------------------------------------------------------------------
// Spiele
// ---------------------------------------------------------------------------

const HOST_MARK = /\s*\(H\)\s*$/;

function parseDate(value: string): string | undefined {
  const day = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(value);
  if (!day) return undefined;
  const time = /\b(\d{1,2}):(\d{2})\b/.exec(value.slice(day.index + day[0].length));
  const date = `${day[3]}-${day[2].padStart(2, "0")}-${day[1].padStart(2, "0")}`;
  return time ? `${date} ${time[1].padStart(2, "0")}:${time[2]}` : date;
}

function parseMatches(table: string): BvvMatch[] {
  const header = headerOf(table);
  const col = (name: string) => header.findIndex((cell) => cell === name);
  const at = { date: col("Datum"), number: col("Nr."), a: col("Team A"), b: col("Team B"), result: col("Ergebnis"), sets: col("Sätze") };
  if (at.date < 0 || at.a < 0 || at.b < 0) return [];

  const matches: BvvMatch[] = [];
  for (const row of rowsOf(section(table, "tbody"))) {
    const cells = cellsOf(row).map(text);
    const date = parseDate(cells[at.date] ?? "");
    const rawA = cells[at.a] ?? "";
    const rawB = cells[at.b] ?? "";
    if (!date || !rawA || !rawB) continue;

    const result = /^(\d+)\s*:\s*(\d+)$/.exec(cells[at.result] ?? "");
    const sets = (cells[at.sets] ?? "")
      .split(/[,\s]+/)
      .filter((set) => /^\d+:\d+$/.test(set));
    const number = toInt(cells[at.number] ?? "");

    matches.push({
      number: number || undefined,
      date,
      teamA: rawA.replace(HOST_MARK, ""),
      teamB: rawB.replace(HOST_MARK, ""),
      host: HOST_MARK.test(rawA) ? "A" : HOST_MARK.test(rawB) ? "B" : undefined,
      result: result ? [Number(result[1]), Number(result[2])] : undefined,
      sets: result ? sets : [],
    });
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Tabelle
// ---------------------------------------------------------------------------

function parseTable(table: string): BvvTableRow[] {
  const header = headerOf(table);
  const col = (name: string) => header.findIndex((cell) => cell === name);
  const at = { position: col("#"), team: col("Team"), played: col("ges."), won: col("gew."), lost: col("verl."), points: col("Punkte") };
  if (at.team < 0 || at.points < 0 || at.played < 0) return [];
  // Sätze und Bälle haben keinen eigenen Kopf, sie stehen jeweils vor „Quot.“
  const quotients = header.flatMap((cell, index) => (cell === "Quot." ? [index] : []));

  return rowsOf(section(table, "tbody"))
    .map((row) => cellsOf(row).map(text))
    .filter((cells) => cells.length >= header.length && cells[at.team])
    .map((cells) => ({
      position: toInt(cells[at.position] ?? ""),
      team: cells[at.team],
      played: toInt(cells[at.played]),
      won: toInt(cells[at.won]),
      lost: toInt(cells[at.lost]),
      points: toInt(cells[at.points]),
      sets: quotients[0] ? cells[quotients[0] - 1] : "",
      balls: quotients[1] ? cells[quotients[1] - 1] : "",
    }));
}

// ---------------------------------------------------------------------------
// Ganze Seite
// ---------------------------------------------------------------------------

export function parseBvvLeague(html: string): BvvLeague {
  const matches = new Map<string, BvvMatch>();
  const tables: BvvTableRow[][] = [];

  for (const table of tablesOf(html)) {
    const header = headerOf(table);
    if (header.includes("Team A") && header.includes("Team B")) {
      for (const match of parseMatches(table)) {
        matches.set(`${match.number ?? ""}|${match.date}|${match.teamA}|${match.teamB}`, match);
      }
    } else if (header.includes("Team") && header.includes("Punkte")) {
      const rows = parseTable(table);
      if (rows.length > 0) tables.push(rows);
    }
  }

  if (matches.size === 0) {
    throw new Error("Auf der BVV-Seite wurden keine Spiele gefunden – hat sich der Aufbau der Seite geändert?");
  }

  return {
    matches: [...matches.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.number ?? 0) - (b.number ?? 0)),
    tables,
  };
}
