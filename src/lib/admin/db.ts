import "server-only";

import { promises as fs } from "node:fs";

import { type Db, MongoClient, type MongoClientOptions } from "mongodb";

import { decrypt, encrypt } from "./crypto";
import { DATA_DIR, FILES, readFile } from "./storage";

/*
 * Die Datenbankverbindung (MongoDB), im Browser eingerichtet (Muster aus t-orga).
 *
 * Henne und Ei: Die Verbindung kann nicht in der Datenbank liegen. Sie steht
 * in `data/datenbank.json`, das Passwort darin mit dem App-Geheimnis
 * verschlüsselt. Die Datei wird bei jedem Zugriff gelesen – ein Wechsel greift
 * ohne Neustart. Keine MONGODB_URI, keine .env.
 */

export type ConnectionInput = {
  host: string;
  port?: number;
  user: string;
  password?: string;
  database: string;
  authSource?: string;
  tls?: boolean;
  srv?: boolean;
};

type Stored = Omit<ConnectionInput, "password"> & { port: number; passwordEncrypted?: string; changedAt?: string };

function readStored(): Stored | null {
  const raw = readFile(FILES.database);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

/**
 * Benutzer und Passwort als Optionen statt in der Adresse – sonst zerlegt die
 * URL-Kodierung Sonderzeichen im Passwort. `directConnection` bei einzelnen
 * Servern: sonst steuert der Treiber den intern beworbenen Hostnamen an.
 */
function build(input: ConnectionInput & { password: string }): { uri: string; options: MongoClientOptions } {
  const scheme = input.srv ? "mongodb+srv" : "mongodb";
  const hostPart = input.srv ? input.host : `${input.host}:${input.port || 27017}`;
  const options: MongoClientOptions = {};
  if (input.user) options.auth = { username: input.user, password: input.password };
  if (input.authSource) options.authSource = input.authSource;
  if (input.tls) options.tls = true;
  if (!input.srv) options.directConnection = true;
  return { uri: `${scheme}://${hostPart}/`, options };
}

type Active = { uri: string; options: MongoClientOptions; database: string };

function activeConnection(): Active | null {
  const stored = readStored();
  if (!stored?.host || !stored.database) return null;
  const password = stored.passwordEncrypted ? decrypt(stored.passwordEncrypted) : "";
  if (password === null) return null; // mit anderem Geheimnis verschlüsselt
  const { uri, options } = build({ ...stored, password });
  return { uri, options, database: stored.database };
}

export function databaseConfigured(): boolean {
  return activeConnection() !== null;
}

/** Für die Oberfläche – nie das Passwort, nur ob eines hinterlegt ist. */
export function connectionSummary() {
  const stored = readStored();
  if (!stored) return null;
  return {
    server: stored.srv ? stored.host : `${stored.host}:${stored.port}`,
    user: stored.user,
    database: stored.database,
    tls: Boolean(stored.tls),
    srv: Boolean(stored.srv),
    changedAt: stored.changedAt,
  };
}

export async function saveConnection(input: ConnectionInput): Promise<void> {
  const before = readStored();
  // Leeres Passwortfeld heißt „unverändert lassen“
  const passwordEncrypted = input.password?.length ? encrypt(input.password) : before?.passwordEncrypted;
  const stored: Stored = {
    host: input.host.trim(),
    port: Number(input.port) || 27017,
    user: input.user.trim(),
    database: input.database.trim(),
    authSource: input.authSource?.trim() || undefined,
    tls: Boolean(input.tls),
    srv: Boolean(input.srv),
    passwordEncrypted,
    changedAt: new Date().toISOString(),
  };
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILES.database, JSON.stringify(stored, null, 2), { encoding: "utf8", mode: 0o600 });
  } catch (error) {
    throw new Error(
      `Der Ordner ${DATA_DIR} ist nicht beschreibbar – die Verbindung wäre nach dem nächsten Neustart weg. ` +
        `Im Docker-Betrieb muss das Volume dem Benutzer 1000 gehören (start.sh erledigt das). Meldung: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Verbindung mit eigenem, kurzlebigem Client testen. */
export async function testConnection(input?: ConnectionInput): Promise<{ ok: true; ms: number } | { ok: false; error: string }> {
  let target: Active | null;
  if (input) {
    const stored = readStored();
    const password = input.password || (stored?.passwordEncrypted ? (decrypt(stored.passwordEncrypted) ?? "") : "");
    const { uri, options } = build({ ...input, host: input.host.trim(), user: input.user.trim(), password });
    target = { uri, options, database: input.database.trim() };
  } else {
    target = activeConnection();
    if (!target) return { ok: false, error: "Es ist noch keine Verbindung gespeichert." };
  }
  const client = new MongoClient(target.uri, { ...target.options, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
  const start = Date.now();
  try {
    await client.connect();
    const db = client.db(target.database);
    await db.command({ ping: 1 });
    // Schreibrecht gleich mitprüfen – ein Lesezugang allein reicht nicht
    const probe = db.collection("_verbindungstest");
    await probe.insertOne({ at: new Date() });
    await probe.drop().catch(() => {});
    return { ok: true, ms: Date.now() - start };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  } finally {
    await client.close().catch(() => {});
  }
}

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Authentication failed|bad auth/i.test(message)) return "Anmeldung an der Datenbank fehlgeschlagen – Benutzer, Passwort oder Auth-Datenbank prüfen.";
  if (/ECONNREFUSED|ENOTFOUND|getaddrinfo|Server selection timed out|timed out/i.test(message)) {
    return "Der Datenbankserver ist nicht erreichbar – Adresse, Port und Firewall prüfen.";
  }
  if (/not authorized/i.test(message)) return "Der Benutzer darf in dieser Datenbank nicht schreiben.";
  return message;
}

/* ------------------------------ Laufender Pool ---------------------------- */

const shared = globalThis as unknown as {
  __adminMongo?: { key: string; client: MongoClient; indexes: Promise<void> | null; indexFailedAt: number | null };
};

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("Es ist noch keine Datenbank eingerichtet.");
  }
}

/** Kontaktnachrichten löschen sich nach spätestens 12 Monaten selbst (siehe Datenschutz). */
export const MESSAGE_RETENTION_DAYS = 365;

async function createIndexes(db: Db): Promise<void> {
  await db.collection("admins").createIndex({ email: 1 }, { unique: true });
  await db.collection("nachrichten").createIndex({ receivedAt: -1 });
  await db.collection("nachrichten").createIndex({ receivedAt: 1 }, { expireAfterSeconds: MESSAGE_RETENTION_DAYS * 24 * 60 * 60, name: "loeschfrist" });
}

export async function database(): Promise<Db> {
  const active = activeConnection();
  if (!active) throw new DatabaseNotConfigured();
  const key = JSON.stringify([active.uri, active.database, active.options]);
  if (!shared.__adminMongo || shared.__adminMongo.key !== key) {
    shared.__adminMongo?.client.close().catch(() => {});
    shared.__adminMongo = {
      key,
      client: new MongoClient(active.uri, { ...active.options, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 10_000, socketTimeoutMS: 20_000 }),
      indexes: null,
      indexFailedAt: null,
    };
  }
  const state = shared.__adminMongo;
  const db = state.client.db(active.database);
  // Nach einem Fehler nicht bei jeder Anfrage erneut versuchen, sondern frühestens nach einer Minute
  if (!state.indexes && (!state.indexFailedAt || Date.now() - state.indexFailedAt > 60_000)) {
    state.indexes = createIndexes(db).catch((error) => {
      console.error("[admin] Indizes ließen sich nicht anlegen:", describeError(error));
      state.indexes = null;
      state.indexFailedAt = Date.now();
    });
  }
  if (state.indexes) await state.indexes;
  return db;
}
