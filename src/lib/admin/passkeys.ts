import "server-only";

import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

/*
 * Passkeys (WebAuthn) als zweiter Faktor – Face ID, Touch ID, Windows Hello,
 * Android-Fingerabdruck, Sicherheitsschlüssel, iCloud-Schlüsselbund. Der
 * private Schlüssel verlässt das Gerät nie, gespeichert wird nur der
 * öffentliche Teil. Die Prüfung der Signaturen übernimmt @simplewebauthn
 * (wie bei t-orga) – das von Hand zu bauen wäre eine Sicherheitslücke.
 *
 * PASSKEYS BRAUCHEN EINEN ECHTEN HOST: HTTPS mit Domain oder localhost. Über
 * die nackte Server-IP (http://10.250.1.30:3100) lässt der Browser keine zu.
 */

export type StoredPasskey = {
  id: string;
  publicKey: string;
  counter: number;
  name: string;
  createdAt: Date;
  lastUsedAt?: Date;
  transports?: string[];
};

const TIMEOUT_MS = 120_000;

type Environment = { rpID: string; origin: string } | null;

/**
 * Kennung (rpID) und erwartete Herkunft aus dem Host der Anfrage. Die rpID ist
 * die Domain ohne `admin.` – ein Passkey gilt für die Domain und ihre
 * Unterdomains und bleibt so auch bei einem Umzug des Admin-Hosts gültig.
 */
export function passkeyEnvironment(headers: { get(name: string): string | null }): Environment {
  const hostWithPort = (headers.get("x-forwarded-host") || headers.get("host") || "").split(",")[0].trim().toLowerCase();
  const host = hostWithPort.split(":")[0];
  if (!host) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return { rpID: host, origin: `http://${hostWithPort}` };
  // IP-Adressen sind für WebAuthn keine gültige Kennung
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes("[") || !host.includes(".")) return null;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (proto !== "https") return null;
  return { rpID: host.replace(/^admin\./, ""), origin: `https://${host}` };
}

/* ------------------- Aufgabe (challenge): genau ein Versuch ---------------- */

/*
 * Die Zufallsaufgabe, die der Passkey unterschreibt, liegt im Arbeitsspeicher
 * des Servers (ein Container) – nicht in einem Cookie: Eine mitgeschnittene
 * Antwort ließe sich sonst mitsamt ihrer Aufgabe erneut einreichen. Sie gilt
 * zwei Minuten und wird beim ersten Versuch verbraucht.
 */
const challenges = ((globalThis as unknown as { __adminChallenges?: Map<string, { challenge: string; expires: number }> }).__adminChallenges ??=
  new Map());

function remember(key: string, challenge: string) {
  const now = Date.now();
  for (const [k, v] of challenges) if (v.expires < now) challenges.delete(k);
  challenges.set(key, { challenge, expires: now + TIMEOUT_MS });
}

function consume(key: string): string | null {
  const entry = challenges.get(key);
  challenges.delete(key);
  return entry && entry.expires > Date.now() ? entry.challenge : null;
}

/* --------------------------------- Anlegen -------------------------------- */

export async function registrationOptions(env: NonNullable<Environment>, admin: { id: string; email: string; name: string }, existing: StoredPasskey[]) {
  const options = await generateRegistrationOptions({
    rpName: "marcel-richter · Admin",
    rpID: env.rpID,
    userID: new TextEncoder().encode(admin.id),
    userName: admin.email,
    userDisplayName: admin.name,
    timeout: TIMEOUT_MS,
    // Kein Gerätenachweis nötig (Apple liefert ohnehin nur „none“)
    attestationType: "none",
    // Dasselbe Gerät nicht zweimal anlegen
    excludeCredentials: existing.map((passkey) => ({ id: passkey.id })),
    authenticatorSelection: { userVerification: "preferred", residentKey: "preferred" },
  });
  remember(`anlegen:${admin.id}`, options.challenge);
  return options;
}

export async function verifyRegistration(
  env: NonNullable<Environment>,
  adminId: string,
  response: RegistrationResponseJSON,
): Promise<Omit<StoredPasskey, "name" | "createdAt"> | null> {
  const challenge = consume(`anlegen:${adminId}`);
  if (!challenge) return null;
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: env.origin,
    expectedRPID: env.rpID,
    requireUserVerification: false,
  }).catch(() => null);
  if (!result?.verified) return null;
  const { credential } = result.registrationInfo;
  return {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports,
  };
}

/* -------------------------------- Bestätigen ------------------------------ */

export async function authenticationOptions(env: NonNullable<Environment>, adminId: string, passkeys: StoredPasskey[]) {
  const options = await generateAuthenticationOptions({
    rpID: env.rpID,
    timeout: TIMEOUT_MS,
    // Nur die Schlüssel dieses Zugangs
    allowCredentials: passkeys.map((passkey) => ({ id: passkey.id })),
    userVerification: "preferred",
  });
  remember(`anmelden:${adminId}`, options.challenge);
  return options;
}

/** Prüft die Antwort; liefert den neuen Zählerstand (läuft er rückwärts, ist der Schlüssel geklont). */
export async function verifyAuthentication(
  env: NonNullable<Environment>,
  adminId: string,
  response: AuthenticationResponseJSON,
  passkey: StoredPasskey,
): Promise<{ counter: number } | null> {
  const challenge = consume(`anmelden:${adminId}`);
  if (!challenge) return null;
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: env.origin,
    expectedRPID: env.rpID,
    credential: {
      id: passkey.id,
      publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
      counter: passkey.counter,
    },
    requireUserVerification: false,
  }).catch(() => null);
  return result?.verified ? { counter: result.authenticationInfo.newCounter } : null;
}
