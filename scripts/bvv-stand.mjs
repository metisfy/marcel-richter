// Speichert den aktuellen Spielplan aller Saisons als „letzten bekannten
// Stand“ (content/saison/<saison>.bvv.json). Antwortet der Bayerische
// Volleyball-Verband beim Build nicht (samstags oft überlastet), baut die
// Website mit diesem Stand statt ganz ohne Spielplan.
//
//   npm run dev                (in einem zweiten Terminal)
//   npm run bvv:stand
//
// Danach committen und pushen. Gespeichert werden nur Mannschaften,
// Ergebnisse, Tabelle und die eigenen Einsätze – keine Namen anderer Spieler.
import { writeFileSync } from "node:fs";

const port = process.env.PORT ?? "3000";
let response;
try {
  response = await fetch(`http://localhost:${port}/api/bvv-stand`, { signal: AbortSignal.timeout(10 * 60_000) });
} catch (error) {
  console.error(`✗ Kein Entwicklungsserver auf Port ${port} (${error.message}). Erst „npm run dev“ starten.`);
  process.exit(1);
}
if (!response.ok) {
  console.error(`✗ ${response.status}: ${await response.text()}`);
  process.exit(1);
}

let failed = false;
for (const { id, error, snapshot } of await response.json()) {
  if (!snapshot) {
    console.error(`✗ ${id}: BVV nicht erreichbar (${error ?? "keine Daten"}) – Datei nicht geändert.`);
    failed = true;
    continue;
  }
  const target = new URL(`../content/saison/${id}.bvv.json`, import.meta.url);
  writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`✓ ${id}: ${snapshot.fixtures.length} eigene Spiele, Stand ${snapshot.updatedAt} → ${target.pathname}`);
}
process.exit(failed ? 1 : 0);
