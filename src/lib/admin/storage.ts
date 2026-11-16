import "server-only";

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Die Ablage: der Ordner `data/`, im Betrieb das Volume `marcel-richter-daten`
 * (docker-compose.yml). Darin liegt nur, was nicht in die Datenbank kann:
 *
 *   geheimnis                signiert Sitzungen, verschlüsselt Passwörter
 *   datenbank.json           die im Browser eingerichtete Verbindung
 *   einrichtungsschluessel   schützt den Assistenten, bis er durch ist
 *   eingerichtet             Markierung „Assistent abgeschlossen“
 *
 * Keine Umgebungsvariablen, keine Zugangsdaten im Code oder Image: Was hier
 * nicht liegt, wird im Browser eingerichtet. Geheimnisse erzeugt die Anwendung
 * selbst. (Muster aus t-orga.)
 */
export const DATA_DIR = path.join(process.cwd(), "data");

export const FILES = {
  secret: path.join(DATA_DIR, "geheimnis"),
  database: path.join(DATA_DIR, "datenbank.json"),
  setupKey: path.join(DATA_DIR, "einrichtungsschluessel"),
  setupDone: path.join(DATA_DIR, "eingerichtet"),
} as const;

export function readFile(file: string): string | null {
  try {
    const value = readFileSync(file, "utf8").trim();
    return value.length ? value : null;
  } catch {
    return null;
  }
}

export function writeFile(file: string, value: string): boolean {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    // 0600: nur der Prozessbenutzer darf lesen
    writeFileSync(file, value, { encoding: "utf8", mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------ App-Geheimnis ----------------------------- */

const shared = globalThis as unknown as { __adminSecret?: string };

/**
 * Beim ersten Zugriff erzeugt und abgelegt. Lässt es sich nicht ablegen
 * (Ordner nicht beschreibbar), lebt es bis zum Neustart im Speicher – dann
 * sind danach alle Anmeldungen ungültig.
 */
export function appSecret(): string {
  if (shared.__adminSecret) return shared.__adminSecret;
  const existing = readFile(FILES.secret);
  if (existing) return (shared.__adminSecret = existing);
  const fresh = randomBytes(48).toString("base64url");
  writeFile(FILES.secret, fresh);
  return (shared.__adminSecret = fresh);
}

/* -------------------------- Einrichtungsschlüssel ------------------------- */

/** Ohne 0/O/1/l/I – die werden beim Abtippen verwechselt. */
const KEY_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

export function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Der Einrichtungsschlüssel – beim ersten Aufruf erzeugt und abgelegt. */
export function setupKey(): string {
  const existing = readFile(FILES.setupKey);
  if (existing) return existing;
  const bytes = randomBytes(16);
  let key = "";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) key += "-";
    key += KEY_CHARS[bytes[i] % KEY_CHARS.length];
  }
  writeFile(FILES.setupKey, key);
  return key;
}

export function setupKeyMatches(input: string): boolean {
  const a = normalizeKey(input);
  const b = normalizeKey(setupKey());
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------- Markierung ------------------------------- */

export function wizardDone(): boolean {
  return readFile(FILES.setupDone) !== null;
}

export function finishWizard(): void {
  if (!writeFile(FILES.setupDone, new Date().toISOString())) {
    throw new Error(
      `Die Einrichtung ließe sich nicht vermerken: ${DATA_DIR} ist nicht beschreibbar. ` +
        "Im Docker-Betrieb muss das Volume dem Benutzer 1000 gehören – start.sh erledigt das.",
    );
  }
  // Der Schlüssel hat seinen Zweck erfüllt
  try {
    unlinkSync(FILES.setupKey);
  } catch {
    /* war nicht da */
  }
}

/**
 * Liegt die Ablage auf einem eingehängten Volume? Sonst wäre die Einrichtung
 * mit dem nächsten Container weg. Nur unter Linux prüfbar; sonst `null`.
 */
export function dataDirPersistent(): boolean | null {
  if (process.platform !== "linux") return null;
  try {
    const mounts = readFileSync("/proc/self/mountinfo", "utf8");
    return mounts.split("\n").some((line) => line.split(" ")[4] === DATA_DIR);
  } catch {
    return null;
  }
}
