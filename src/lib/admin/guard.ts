import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { type Admin, adminById } from "./accounts";
import { databaseConfigured } from "./db";
import { adminPrefixFor, hostFrom } from "./hosts";
import { SESSION_COOKIE, SESSION_DURATION_MS, createToken, readToken } from "./session";
import { appSecret, wizardDone } from "./storage";

/*
 * Die Zugriffsschicht. Jede geschützte Seite und jede Server-Aktion ruft
 * `requireAdmin()` bzw. `adminForAction()` auf – Layouts allein schützen
 * nichts (sie rendern bei Navigation nicht neu, siehe Next-Doku).
 */

const SCOPE = "admin";

/** Eingerichtet = Assistent durch UND Datenbankverbindung lesbar. */
export function setupComplete(): boolean {
  return wizardDone() && databaseConfigured();
}

/** Link-Präfix der laufenden Anfrage: leer auf admin.<domain>, sonst /admin. */
export const adminPrefix = cache(async (): Promise<string> => adminPrefixFor(hostFrom(await headers())));

/**
 * Angemeldeter Admin der laufenden Anfrage. Name und Zustand kommen frisch aus
 * der Datenbank: Ein gesperrter Zugang oder ein geändertes Passwort (höhere
 * Generation) beendet die Sitzung sofort, nicht erst nach Ablauf des Cookies.
 */
export const currentAdmin = cache(async (): Promise<Admin | null> => {
  if (!setupComplete()) return null;
  const session = await readToken(SCOPE, (await cookies()).get(SESSION_COOKIE)?.value, appSecret());
  if (!session) return null;
  try {
    const admin = await adminById(session.id);
    if (!admin || !admin.active || admin.gen !== session.gen) return null;
    return admin;
  } catch {
    // Datenbank weg: lieber abmelden als ungeprüft durchlassen
    return null;
  }
});

/** Für Seiten: ohne Einrichtung zum Assistenten, ohne Sitzung zur Anmeldung. */
export async function requireAdmin(path = "/"): Promise<Admin> {
  const prefix = await adminPrefix();
  if (!setupComplete()) redirect(prefix || "/");
  const admin = await currentAdmin();
  if (!admin) redirect(`${prefix}/anmelden${path !== "/" ? `?weiter=${encodeURIComponent(path)}` : ""}`);
  return admin;
}

/** Für Server-Aktionen: Admin oder Fehler, keine Weiterleitung. */
export async function adminForAction(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) throw new Error("Nicht angemeldet.");
  return admin;
}

async function secureCookie(): Promise<boolean> {
  // Hinter dem Reverse Proxy kommt HTTPS an, auf dem nackten Port (intern) nicht
  return (await headers()).get("x-forwarded-proto") === "https";
}

export async function signIn(admin: Pick<Admin, "id" | "gen">): Promise<void> {
  const token = await createToken(SCOPE, appSecret(), { id: admin.id, gen: admin.gen });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookie(),
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(STEP_COOKIE);
}

/** Nur relative Pfade – keine offene Weiterleitung auf fremde Hosts. */
export function safeTarget(target: string): string {
  return target.startsWith("/") && !target.startsWith("//") && !target.startsWith("/\\") ? target : "/";
}

/* -------------------- Zwischenschritt Passwort → 2. Faktor ----------------- */

/*
 * Passwort stimmt, angemeldet ist aber noch niemand. Eigenes signiertes Cookie
 * mit eigenem Namensraum, fünf Minuten gültig. Der Passwort-Hash geht in die
 * Signatur ein: Wird das Passwort geändert, ist der Zwischenschritt wertlos.
 */
const STEP_COOKIE = "mr_admin_2fa";
const STEP_MS = 5 * 60 * 1000;

const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

function stepSignature(id: string, expires: number, passwordHash: string): string {
  return b64url(createHmac("sha256", `${appSecret()}.${passwordHash}`).update(`zweiFaktor.${id}.${expires}`).digest());
}

export async function setTwoFactorStep(id: string, passwordHash: string): Promise<void> {
  const expires = Date.now() + STEP_MS;
  (await cookies()).set(STEP_COOKIE, `${b64url(id)}.${expires}.${stepSignature(id, expires, passwordHash)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookie(),
    path: "/",
    maxAge: STEP_MS / 1000,
  });
}

/** Admin-ID aus dem Zwischenschritt – oder `null`. */
export async function readTwoFactorStep(passwordHashOf: (id: string) => Promise<string | null>): Promise<string | null> {
  const token = (await cookies()).get(STEP_COOKIE)?.value;
  const [idPart, expiresPart, signature] = token?.split(".") ?? [];
  if (!idPart || !expiresPart || !signature) return null;
  const expires = Number(expiresPart);
  if (!Number.isFinite(expires) || expires <= Date.now()) return null;
  const id = Buffer.from(idPart, "base64url").toString("utf8");
  const hash = await passwordHashOf(id);
  if (!hash) return null;
  const expected = Buffer.from(stepSignature(id, expires, hash));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null;
}

export async function clearTwoFactorStep(): Promise<void> {
  (await cookies()).delete(STEP_COOKIE);
}

/* ------------------------------ Bremse für Anmeldungen -------------------- */

/*
 * Gegen Durchprobieren: je IP höchstens 10 Fehlversuche, je E-Mail-Adresse
 * höchstens 5 in 15 Minuten. Liegt nur im Arbeitsspeicher.
 */
const WINDOW_MS = 15 * 60 * 1000;
const throttleHost = globalThis as unknown as { __adminThrottle?: Map<string, number[]> };
const throttle: Map<string, number[]> = (throttleHost.__adminThrottle ??= new Map<string, number[]>());

function recent(key: string): number[] {
  const now = Date.now();
  const list = (throttle.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (list.length) throttle.set(key, list);
  else throttle.delete(key);
  return list;
}

export async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unbekannt";
}

export function loginBlocked(ip: string, email: string): boolean {
  return recent(`ip:${ip}`).length >= 10 || recent(`mail:${email.trim().toLowerCase()}`).length >= 5;
}

export function loginFailed(ip: string, email: string): void {
  for (const key of [`ip:${ip}`, `mail:${email.trim().toLowerCase()}`]) throttle.set(key, [...recent(key), Date.now()]);
}

export function loginSucceeded(email: string): void {
  throttle.delete(`mail:${email.trim().toLowerCase()}`);
}
