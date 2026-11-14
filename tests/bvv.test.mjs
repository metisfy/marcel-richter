// Tests für den BVV-Parser (src/lib/bvv.ts) mit echten, gekürzten Seiten des
// Bayerischen Volleyball-Verbands vom 13.11.2026 (tests/fixtures/).
//
//   npm test
//
// Läuft ohne Next.js: Node.js 24 führt TypeScript-Dateien direkt aus.
// Ändert der BVV den Aufbau seiner Seiten, bitte neue Seiten speichern
// (Ligaseite, je eine Spielseite vor und nach dem Spiel) und die erwarteten
// Werte unten anpassen.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parseBvvLeague, parseBvvLineups, parseBvvMatchDetail } from "../src/lib/bvv.ts";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("Ligaseite", () => {
  const league = parseBvvLeague(fixture("bvv-liga.html"));
  const pfuhl = league.matches.filter((match) => match.teamA === "TSV Pfuhl" || match.teamB === "TSV Pfuhl");

  it("findet alle Spiele der Liga", () => {
    assert.equal(league.matches.length, 72);
    assert.equal(pfuhl.length, 16);
  });

  it("liest Datum, Uhrzeit, Spielnummer, Ergebnis und Sätze", () => {
    const first = pfuhl[0];
    assert.equal(first.date, "2026-10-10 13:00");
    assert.equal(first.number, 5);
    assert.equal(first.teamA, "TSV Haunstetten II");
    assert.equal(first.teamB, "TSV Pfuhl");
    assert.deepEqual(first.result, [1, 3]);
    assert.deepEqual(first.sets, ["25:20", "21:25", "17:25", "15:25"]);
  });

  it("erkennt den Ausrichter („(H)“) und lässt ihn aus dem Namen", () => {
    assert.equal(pfuhl[0].host, "A");
    assert.equal(pfuhl[1].host, undefined);
    assert.ok(league.matches.every((match) => !match.teamA.includes("(H)") && !match.teamB.includes("(H)")));
  });

  it("kennt offene Spiele (ohne Ergebnis, ohne Sätze)", () => {
    const open = pfuhl.find((match) => match.number === 17);
    assert.equal(open?.date, "2026-11-14 14:30");
    assert.equal(open?.result, undefined);
    assert.deepEqual(open?.sets, []);
  });

  it("verlinkt nur auf Spielseiten von volleyball.bayern", () => {
    assert.ok(pfuhl.every((match) => match.url?.startsWith("https://volleyball.bayern/ergebnisse/") && /\/spiel-\d+$/.test(match.url)));
  });

  it("liest die Tabelle", () => {
    const table = league.tables.at(-1);
    assert.equal(table?.length, 9);
    const row = table?.find((entry) => entry.team === "TSV Pfuhl");
    assert.deepEqual(row, { position: 3, team: "TSV Pfuhl", played: 4, won: 2, lost: 2, points: 7, sets: "8:8", balls: "344:347" });
  });

  it("übernimmt Archiv-Links samt Prüfsumme (…/spiel-123?…&cHash=…)", () => {
    const archive = parseBvvLeague(`<table><thead><tr><th>Datum</th><th>Nr.</th><th>Team A</th><th>Team B</th><th>Ergebnis</th><th>Sätze</th><th></th></tr></thead>
      <tbody><tr><td>Samstag, 18.10.2025<br>13:00 Uhr</td><td>12</td><td><a href="/ergebnisse/ergebnis-archiv/team-1">TSV Pfuhl</a> (H)</td><td>DJK Augsburg Hochzoll II</td>
      <td>1:3</td><td>22:25, 25:23, 20:25, 24:25</td>
      <td><a href="/ergebnisse/ergebnis-archiv/spiel-377213?tx_bvvportal_resultsarchive%5BwettbewerbId%5D=38655&amp;cHash=abc123">→</a></td></tr></tbody></table>`);
    assert.equal(
      archive.matches[0].url,
      "https://volleyball.bayern/ergebnisse/ergebnis-archiv/spiel-377213?tx_bvvportal_resultsarchive%5BwettbewerbId%5D=38655&cHash=abc123",
    );
    assert.equal(archive.matches[0].host, "A");
  });

  it("wirft einen Fehler, wenn keine Spiele gefunden werden", () => {
    assert.throws(() => parseBvvLeague("<html><body><p>Wartung</p></body></html>"), /keine Spiele gefunden/);
  });
});

describe("Spielseite nach dem Spiel", () => {
  const detail = parseBvvMatchDetail(fixture("bvv-spiel-gespielt.html"));

  it("liest Schiedsgericht, Ausrichter und Halle mit Koordinaten", () => {
    assert.equal(detail.referee, "SSV Bobingen");
    assert.equal(detail.host, "TSV Haunstetten II");
    assert.equal(detail.venue?.name, "Sporthalle Haunstetten");
    assert.equal(detail.venue?.street, "Karl-Rommel-Weg 11");
    assert.equal(detail.venue?.city, "86179 Augsburg");
    assert.ok(Math.abs((detail.venue?.lat ?? 0) - 48.301) < 0.01);
    assert.ok(Math.abs((detail.venue?.lng ?? 0) - 10.8976) < 0.01);
  });

  it("liest die Bälle beider Mannschaften", () => {
    assert.deepEqual(detail.balls, [
      { team: "TSV Haunstetten II", balls: 78 },
      { team: "TSV Pfuhl", balls: 95 },
    ]);
  });

  it("liest beide Spielerlisten mit „eingesetzt“ und „Libero“", () => {
    const lineups = parseBvvLineups(fixture("bvv-spiel-gespielt.html"));
    assert.deepEqual(
      lineups.map((lineup) => [lineup.team, lineup.players.length]),
      [
        ["TSV Haunstetten II", 12],
        ["TSV Pfuhl", 10],
      ],
    );
    const me = lineups[1].players.find((player) => player.lastName === "Richter");
    assert.deepEqual(me, { lastName: "Richter", firstName: "Marcel", played: true, libero: false });
  });

  it("liest den Tabellenverlauf", () => {
    const pfuhl = detail.ranking.find((entry) => entry.team === "TSV Pfuhl");
    assert.deepEqual(pfuhl?.positions, [
      { date: "2026-10-10", position: 3 },
      { date: "2026-10-24", position: 3 },
    ]);
  });
});

describe("Spielseite vor dem Spiel", () => {
  const detail = parseBvvMatchDetail(fixture("bvv-spiel-offen.html"));

  it("kennt Schiedsgericht und Ausrichter, aber noch keine Halle und keine Spieler", () => {
    assert.equal(detail.referee, "SG TuS Fürstenfeldbruck / TSG Maisach");
    assert.equal(detail.host, "SSV Bobingen");
    assert.equal(detail.venue, undefined);
    assert.deepEqual(detail.balls, []);
    assert.deepEqual(detail.lineups, []);
  });
});
