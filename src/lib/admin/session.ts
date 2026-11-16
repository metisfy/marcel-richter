/**
 * Sitzungen: ein signiertes Cookie, kein Server-Zustand (Muster aus t-orga).
 * Signiert wird `<namensraum>.<nutzlast>` – ein Token aus einem anderen
 * Namensraum (z. B. der 2FA-Zwischenschritt) ist hier nie gültig.
 *
 * Web Crypto statt node:crypto, damit die Datei auch im Proxy laufen könnte.
 * Verbindlich geprüft wird in `guard.ts`, direkt an den Daten.
 */

export const SESSION_COOKIE = "mr_admin";

/** 12 Stunden, danach neu anmelden. */
export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export type Session = {
  exp: number;
  id: string;
  /** Zähler am Konto: steigt bei Passwortwechsel/„überall abmelden“ und macht alte Cookies ungültig. */
  gen: number;
};

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): string {
  const padding = value.length % 4 ? "=".repeat(4 - (value.length % 4)) : "";
  const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data))));
}

export async function createToken(scope: string, secret: string, data: Omit<Session, "exp">, durationMs = SESSION_DURATION_MS): Promise<string> {
  const payload: Session = { ...data, exp: Date.now() + durationMs };
  const part = b64url(encoder.encode(JSON.stringify(payload)));
  return `${part}.${await hmac(secret, `${scope}.${part}`)}`;
}

/** Prüft Signatur (konstantzeitig) und Ablauf. */
export async function readToken(scope: string, token: string | undefined, secret: string): Promise<Session | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const part = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!part || !signature) return null;

  const expected = await hmac(secret, `${scope}.${part}`);
  if (signature.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const data = JSON.parse(fromB64url(part)) as Partial<Session>;
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return null;
    if (typeof data.id !== "string" || !data.id) return null;
    return { exp: data.exp, id: data.id, gen: typeof data.gen === "number" ? data.gen : 0 };
  } catch {
    return null;
  }
}
