import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { appSecret } from "./storage";

/*
 * Verschlüsselung gespeicherter Zugangsdaten (DB-Passwort, SMTP-Passwort,
 * TOTP-Schlüssel) mit AES-256-GCM. Der Schlüssel ist aus dem App-Geheimnis
 * abgeleitet, das nur auf dem Volume liegt. Format: v1.<iv>.<tag>.<text>
 */

let derived: { secret: string; key: Buffer } | null = null;

function key(): Buffer {
  const secret = appSecret();
  if (derived?.secret !== secret) derived = { secret, key: scryptSync(secret, "marcel-richter-geheimtext", 32) };
  return derived.key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const text = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), text.toString("base64url")].join(".");
}

/** `null`, wenn der Wert mit einem anderen Geheimnis verschlüsselt wurde. */
export function decrypt(value: string): string | null {
  try {
    const [version, iv, tag, text] = value.split(".");
    if (version !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(text, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* -------------------------------- Passwörter ------------------------------ */

/** scrypt aus der Node-Standardbibliothek. Format: scrypt$<salz>$<hash> */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [method, salt, hash] = stored.split("$");
    if (method !== "scrypt" || !salt || !hash) return false;
    const actual = scryptSync(password, Buffer.from(salt, "hex"), 64);
    const expected = Buffer.from(hash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Für unbekannte E-Mail-Adressen: gleich viel Rechenzeit, damit die Antwortzeit nichts verrät. */
const DUMMY_HASH = hashPassword(randomBytes(12).toString("hex"));
export function burnPasswordCheck(password: string): void {
  verifyPassword(password, DUMMY_HASH);
}

export const PASSWORD_MIN_LENGTH = 12;

/** Mindestanforderung an Passwörter. `null` heißt: in Ordnung. */
export function passwordProblem(password: string): string | null {
  if (password.length > 200) return "Das Passwort ist zu lang (höchstens 200 Zeichen).";
  if (/^\s|\s$/.test(password)) return "Das Passwort darf nicht mit einem Leerzeichen beginnen oder enden.";
  if (password.length < PASSWORD_MIN_LENGTH) return `Das Passwort muss mindestens ${PASSWORD_MIN_LENGTH} Zeichen lang sein.`;
  if (!/\d/.test(password)) return "Bitte mindestens eine Ziffer verwenden.";
  if (!/[A-ZÄÖÜ]/.test(password) || !/[a-zäöüß]/.test(password)) return "Bitte Groß- und Kleinbuchstaben mischen.";
  return null;
}
