import { readFileSync, statSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Schalter für die öffentliche Website, im Admin-Bereich gesetzt:
 *
 *   indexing         Suchmaschinen dürfen die Seite aufnehmen (sonst noindex)
 *   hiddenProjects   Projekte, die auf der Website nicht erscheinen
 *   statistics       Besucherstatistik erfassen
 *
 * Liegen als data/website.json auf dem Volume (wie die übrige Ablage) und
 * NICHT in der Datenbank: Proxy, robots.txt und jede Seite lesen sie bei
 * jedem Aufruf – das darf nie an einer langsamen Datenbank hängen. Ohne Datei
 * (Build, frische Installation) gelten die Standardwerte.
 *
 * Ohne `server-only`, weil der Proxy (Node.js-Laufzeit) sie ebenfalls liest.
 */

export type WebsiteSettings = {
  indexing: boolean;
  hiddenProjects: string[];
  statistics: boolean;
  changedAt?: string;
};

export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = { indexing: true, hiddenProjects: [], statistics: true };

const FILE = path.join(process.cwd(), "data", "website.json");

const cache = ((globalThis as unknown as { __websiteSettings?: { mtime: number; value: WebsiteSettings } }).__websiteSettings ??= {
  mtime: -1,
  value: DEFAULT_WEBSITE_SETTINGS,
});

/** Aktuelle Schalter; liest die Datei nur, wenn sie sich geändert hat. */
export function websiteSettings(): WebsiteSettings {
  let mtime = 0;
  try {
    mtime = statSync(FILE).mtimeMs;
  } catch {
    return DEFAULT_WEBSITE_SETTINGS;
  }
  if (mtime === cache.mtime) return cache.value;
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as Partial<WebsiteSettings>;
    cache.value = {
      indexing: raw.indexing !== false,
      hiddenProjects: Array.isArray(raw.hiddenProjects) ? raw.hiddenProjects.filter((slug) => typeof slug === "string") : [],
      statistics: raw.statistics !== false,
      changedAt: typeof raw.changedAt === "string" ? raw.changedAt : undefined,
    };
    cache.mtime = mtime;
  } catch {
    // halb geschriebene oder kaputte Datei: beim letzten Stand bleiben
  }
  return cache.value;
}

export async function updateWebsiteSettings(change: Partial<Omit<WebsiteSettings, "changedAt">>): Promise<WebsiteSettings> {
  const next: WebsiteSettings = { ...websiteSettings(), ...change, changedAt: new Date().toISOString() };
  await mkdir(path.dirname(FILE), { recursive: true });
  // Erst in eine Nachbardatei, dann umbenennen – nie eine halbe Datei lesen
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(tmp, FILE);
  return websiteSettings();
}

/** Weicht etwas vom Standard ab? (Dann nach dem Start einmal alle Seiten neu erzeugen.) */
export function settingsDiffer(settings: WebsiteSettings): boolean {
  return !settings.indexing || settings.hiddenProjects.length > 0 || !settings.statistics;
}

export function projectVisible(slug: string): boolean {
  return !websiteSettings().hiddenProjects.includes(slug);
}
