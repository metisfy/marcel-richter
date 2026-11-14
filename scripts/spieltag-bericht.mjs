// Legt einen eigenen Spieltagsbericht an – mit dem automatischen Bericht als
// Ausgangstext, den du dann umschreibst oder ergänzt.
//
//   npm run dev                              (in einem zweiten Terminal)
//   npm run bericht -- 2026-10-10            → content/spieltage/2026-10-10.de.mdx
//   npm run bericht -- 2026-10-10 en         → content/spieltage/2026-10-10.en.mdx
//
// Vorhandene Dateien werden nie überschrieben. Danach committen und pushen:
// Auf der Spieltagsseite steht dann dein Text statt des automatischen.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const [datum, sprache = "de"] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(datum ?? "") || !["de", "en"].includes(sprache)) {
  console.error("Aufruf: npm run bericht -- <JJJJ-MM-TT> [de|en]");
  process.exit(1);
}

const target = new URL(`../content/spieltage/${datum}.${sprache}.mdx`, import.meta.url);
if (existsSync(target)) {
  console.error(`✗ ${target.pathname} gibt es schon – nichts überschrieben.`);
  process.exit(1);
}
if (sprache === "en" && !existsSync(new URL(`../content/spieltage/${datum}.de.mdx`, import.meta.url))) {
  console.error("✗ Zuerst die deutsche Fassung anlegen (ohne de.mdx wird keine en.mdx angezeigt).");
  process.exit(1);
}

const port = process.env.PORT ?? "3000";
let response;
try {
  response = await fetch(`http://localhost:${port}/api/spieltag-vorlage/${datum}?sprache=${sprache}`);
} catch {
  console.error(`✗ Kein Entwicklungsserver auf Port ${port}. Erst „npm run dev“ starten.`);
  process.exit(1);
}
if (!response.ok) {
  console.error(`✗ ${response.status}: ${await response.text()}`);
  process.exit(1);
}

mkdirSync(new URL("../content/spieltage/", import.meta.url), { recursive: true });
writeFileSync(target, await response.text());
console.log(`✓ ${target.pathname} angelegt – jetzt bearbeiten, committen, pushen.`);
