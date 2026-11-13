// Prüft live, ob die Website den Spielplan beim BVV noch lesen kann.
//
//   npm run bvv:check
//
// Liest die aktuelle Saisondatei (content/saison/<neueste>.yaml), ruft die
// Ligaseite und eine Spielseite ab und prüft, ob der Parser (src/lib/bvv.ts)
// Spiele, Tabelle und Spielerlisten findet. Läuft täglich in GitHub Actions
// (.github/workflows/bvv-check.yml) – ändert der Verband seine Seiten, wird
// der Lauf rot, bevor jemand eine leere Saisonseite bemerkt.
import { appendFileSync, readdirSync, readFileSync } from "node:fs";

import { parse } from "yaml";

import { parseBvvLeague, parseBvvMatchDetail } from "../src/lib/bvv.ts";

const root = new URL("../", import.meta.url);
const seasonFile = readdirSync(new URL("content/saison/", root)).filter((file) => file.endsWith(".yaml")).sort().at(-1);
const season = parse(readFileSync(new URL(`content/saison/${seasonFile}`, root), "utf8"));
const site = parse(readFileSync(new URL("content/site.yaml", root), "utf8"));

if (!season?.bvv?.url) {
  console.log(`content/saison/${seasonFile} hat keine BVV-Quelle – nichts zu prüfen.`);
  process.exit(0);
}
const team = season.bvv.team ?? site.team.name;

async function get(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; spielplan-abruf/1.0)" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      console.log(`  Versuch ${attempt} für ${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
  throw new Error(`${url} nicht erreichbar: ${lastError?.message}`);
}

const lines = [];
const fail = (message) => {
  console.error(`✗ ${message}`);
  lines.push(`- ✗ ${message}`);
  process.exitCode = 1;
};
const ok = (message) => {
  console.log(`✓ ${message}`);
  lines.push(`- ✓ ${message}`);
};

try {
  const league = parseBvvLeague(await get(season.bvv.url));
  const own = league.matches.filter((match) => match.teamA === team || match.teamB === team);
  ok(`Ligaseite: ${league.matches.length} Spiele, davon ${own.length} mit ${team}`);
  if (own.length === 0) fail(`„${team}“ kommt auf der Ligaseite nicht vor`);

  const table = league.tables.findLast((rows) => rows.some((row) => row.team === team));
  if (table) ok(`Tabelle: ${table.length} Mannschaften, ${team} auf Platz ${table.find((row) => row.team === team)?.position}`);
  else fail("Tabelle nicht gefunden");

  const played = own.findLast((match) => match.result && match.url);
  if (played) {
    const detail = parseBvvMatchDetail(await get(played.url));
    const lineup = detail.lineups.find((entry) => entry.team === team);
    if (lineup?.players.length) ok(`Spielseite ${played.date}: Spielerliste mit ${lineup.players.length} Spielern, Halle: ${detail.venue?.name ?? "–"}`);
    else fail(`Spielseite ${played.url}: keine Spielerliste für ${team} gefunden`);
  } else {
    ok("Noch kein gespieltes Spiel – Spielseite nicht geprüft");
  }
} catch (error) {
  fail(error.message);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### BVV-Prüfung (${seasonFile})\n\n${lines.join("\n")}\n`);
}
