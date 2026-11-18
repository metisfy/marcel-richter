import "server-only";

import nodemailer from "nodemailer";

import type { Locale } from "@/i18n/routing";
import { getSite } from "@/lib/content";
import type { ContactTopic } from "@/lib/contact-shared";
import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";

/*
 * Zustellung des Kontaktformulars per E-Mail (SMTP).
 *
 * Woher der Mailzugang kommt (erste Quelle gewinnt):
 *
 *   1. Umgebung des Containers: SMTP_HOST, SMTP_PORT (587/465), SMTP_USER,
 *      SMTP_PASSWORD, SMTP_FROM (Standard: SMTP_USER), CONTACT_TO
 *   2. Admin-Bereich → Einstellungen → Mailversand (in der Datenbank,
 *      Passwort verschlüsselt mit dem App-Geheimnis)
 *
 * Nie aus dem Code oder dem Image (das Image ist öffentlich). Zusätzlich
 * landet jede Nachricht im Admin-Bereich (src/lib/admin/messages.ts), sobald
 * die Datenbank eingerichtet ist.
 */

export type MailConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
  to: string;
  source: "umgebung" | "admin";
};

const env = (name: string) => process.env[name]?.trim() || undefined;

/** Mailzugang aus der Umgebung (synchron, ohne Datenbank). */
export function envMailConfig(): MailConfig | null {
  const host = env("SMTP_HOST");
  const user = env("SMTP_USER");
  const from = env("SMTP_FROM") ?? user;
  if (!host || !from) return null;
  const port = Number(env("SMTP_PORT") ?? 587);
  return {
    host,
    port: Number.isInteger(port) && port > 0 ? port : 587,
    user,
    password: env("SMTP_PASSWORD"),
    from,
    to: env("CONTACT_TO") ?? getSite("de").email,
    source: "umgebung",
  };
}

/** Wirksamer Mailzugang: Umgebung, sonst Einstellungen aus dem Admin-Bereich. */
export async function mailConfig(): Promise<MailConfig | null> {
  const fromEnv = envMailConfig();
  if (fromEnv) return fromEnv;
  const { setupComplete } = await import("@/lib/admin/guard");
  if (!setupComplete()) return null;
  try {
    const { mailSettingsFromDatabase } = await import("@/lib/admin/mail-settings");
    const stored = await mailSettingsFromDatabase();
    if (!stored) return null;
    return { ...stored, to: stored.to || getSite("de").email, source: "admin" };
  } catch {
    return null;
  }
}

export type MailStatus =
  | { state: "umgebung"; to: string; host: string }
  | { state: "admin"; to: string; host: string }
  /** Im Admin-Bereich gespeichert, aber das Passwort ist mit einem früheren App-Geheimnis verschlüsselt */
  | { state: "unlesbar"; host: string }
  | { state: "fehlt" };

/** Welche SMTP-Variablen kommen im Container an? (nur Namen, nie Werte) */
export function envMailVariables(): string[] {
  return ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "CONTACT_TO"].filter((name) => env(name));
}

/** Wie steht es um den Mailversand – mit Grund, falls er nicht geht. */
export async function mailStatus(): Promise<MailStatus> {
  const fromEnv = envMailConfig();
  if (fromEnv) return { state: "umgebung", to: fromEnv.to, host: fromEnv.host };
  const { setupComplete } = await import("@/lib/admin/guard");
  if (!setupComplete()) return { state: "fehlt" };
  try {
    const { mailSettingsFromDatabase, storedMailSettings } = await import("@/lib/admin/mail-settings");
    const stored = await storedMailSettings();
    if (!stored) return { state: "fehlt" };
    const usable = await mailSettingsFromDatabase();
    if (!usable) return { state: "unlesbar", host: stored.host };
    return { state: "admin", to: usable.to || getSite("de").email, host: usable.host };
  } catch {
    return { state: "fehlt" };
  }
}

/*
 * Einfache Bremse gegen Massenversand: je Absender-IP höchstens 5 Nachrichten
 * in 15 Minuten, insgesamt höchstens 40 pro Stunde. Die IP liegt nur im
 * Arbeitsspeicher und verfällt mit dem Zeitfenster (siehe Datenschutz).
 */
const PER_IP = { max: 5, windowMs: 15 * 60_000 };
const OVERALL = { max: 40, windowMs: 60 * 60_000 };

const shared = globalThis as unknown as { __contactHits?: Map<string, number[]>; __contactAll?: number[] };
const hits = (shared.__contactHits ??= new Map<string, number[]>());
const all = (shared.__contactAll ??= []);

function prune(now: number) {
  for (const [ip, times] of hits) {
    const recent = times.filter((time) => now - time < PER_IP.windowMs);
    if (recent.length === 0) hits.delete(ip);
    else hits.set(ip, recent);
  }
  while (all.length > 0 && now - all[0] >= OVERALL.windowMs) all.shift();
}

/** true, wenn diese IP gerade noch senden darf – und zählt den Versuch. */
export function takeContactSlot(ip: string): boolean {
  const now = Date.now();
  prune(now);
  const times = hits.get(ip) ?? [];
  if (times.length >= PER_IP.max || all.length >= OVERALL.max) return false;
  times.push(now);
  hits.set(ip, times);
  all.push(now);
  // Auch ohne weitere Nachrichten verfällt die IP nach Ablauf des Fensters.
  setTimeout(() => prune(Date.now()), PER_IP.windowMs + 1_000).unref();
  return true;
}

/** IP des Absenders hinter Cloudflare bzw. Reverse Proxy */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unbekannt"
  );
}

/**
 * Kommt die Anfrage von dieser Website? Vergleicht den Origin-Header mit dem
 * Host der Anfrage, dem weitergereichten Host des Proxys und SITE_URL.
 * Ohne Origin (ältere Browser, curl) wird nicht blockiert – dafür sorgen
 * Honeypot und Bremse.
 */
export function sameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = [headers.get("x-forwarded-host"), headers.get("host"), SITE_URL_CONFIGURED ? new URL(SITE_URL).host : null];
  return allowed.some((host) => host?.split(",")[0]?.trim() === originHost);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const TOPIC_LABEL: Record<ContactTopic, string> = {
  project: "Projekt & Zusammenarbeit",
  volleyball: "Volleyball & Verein",
  other: "Sonstiges",
};

/** Kopfzeilen (Betreff, Anzeigename) dürfen keine Zeilenumbrüche enthalten. */
const headerSafe = (value: string, max = 120) => value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function transportFor(config: Pick<MailConfig, "host" | "port" | "user" | "password">) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 spricht von Anfang an TLS, 587 wechselt per STARTTLS (dann Pflicht).
    secure: config.port === 465,
    // Verschlüsselung erzwingen – außer beim Relay auf demselben Rechner
    requireTLS: config.port !== 465 && !LOCAL_HOSTS.has(config.host),
    auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    // Ohne Zeitlimits hängt das Formular an einem stummen Mailserver minutenlang.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Testmail aus dem Admin-Bereich (Einstellungen → Mailversand). */
export async function sendTestMail(config: Omit<MailConfig, "source">): Promise<void> {
  const transport = transportFor(config);
  try {
    await transport.sendMail({
      from: { name: `${getSite("de").name} · Website`, address: config.from },
      to: config.to,
      subject: "Testmail vom Kontaktformular",
      text: "Der Mailversand fürs Kontaktformular funktioniert. Nachrichten von der Website kommen ab jetzt an diese Adresse.",
    });
  } finally {
    transport.close();
  }
}

export type ContactMessage = {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
  locale: Locale;
};

/**
 * Stellt die Nachricht an CONTACT_TO zu. „Antworten“ im Mailprogramm geht
 * direkt an den Absender (Reply-To). Absender der Mail ist das eigene
 * Postfach, nicht die Adresse aus dem Formular – sonst scheitert die Mail an
 * SPF/DKIM.
 *
 * Eine automatische Eingangsbestätigung an die angegebene Adresse gibt es
 * bewusst nicht: Darüber ließe sich das Formular missbrauchen, um Mails mit
 * beliebigem Text an fremde Adressen zu schicken.
 */
export async function sendContactMail(config: MailConfig, message: ContactMessage): Promise<void> {
  const name = headerSafe(message.name, 100);
  const email = headerSafe(message.email, 200);
  const topic = TOPIC_LABEL[message.topic];
  const text = message.message.trim();
  // Ohne echte Domain (SITE_URL) nur „Kontaktformular der Website“ statt localhost
  const page = SITE_URL_CONFIGURED
    ? `${SITE_URL}${message.locale === "de" ? "/kontakt" : "/en/contact"}`
    : "das Kontaktformular der Website";
  const language = message.locale === "de" ? "Deutsch" : "Englisch";
  const received = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date());

  const rows: [string, string][] = [
    ["Name", name],
    ["E-Mail", email],
    ["Anliegen", topic],
    ["Sprache", language],
    ["Eingang", received],
  ];

  const transport = transportFor(config);

  try {
    await transport.sendMail({
      from: { name: `${getSite("de").name} · Website`, address: config.from },
      to: config.to,
      replyTo: { name, address: email },
      subject: headerSafe(`Kontaktformular: ${topic} – ${name}`, 160),
      text: [
        "Neue Nachricht über das Kontaktformular",
        "",
        ...rows.map(([label, value]) => `${`${label}:`.padEnd(10)}${value}`),
        "",
        "Nachricht:",
        text,
        "",
        "—",
        `Gesendet über ${page}. „Antworten“ geht direkt an ${email}.`,
      ].join("\n"),
      html: `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e7e9ee;border-radius:16px;padding:28px">
<p style="margin:0 0 6px;font:500 12px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#3a63d9">Kontaktformular</p>
<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3">${escapeHtml(topic)} – ${escapeHtml(name)}</h1>
<table style="width:100%;border-collapse:collapse;font-size:15px">
${rows
  .map(
    ([label, value]) =>
      `<tr><td style="padding:8px 12px 8px 0;border-top:1px solid #e7e9ee;color:#666;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:8px 0;border-top:1px solid #e7e9ee">${
        label === "E-Mail" ? `<a href="mailto:${escapeHtml(email)}" style="color:#3a63d9">${escapeHtml(value)}</a>` : escapeHtml(value)
      }</td></tr>`,
  )
  .join("\n")}
</table>
<p style="margin:24px 0 8px;font-size:13px;font-weight:600;color:#666">Nachricht</p>
<div style="padding:16px;border-radius:12px;background:#f7f8fa;font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(text)}</div>
<p style="margin:24px 0 0;font-size:13px;color:#666">Gesendet über ${escapeHtml(page)}. „Antworten“ geht direkt an ${escapeHtml(email)}.</p>
</div></body></html>`,
    });
  } finally {
    transport.close();
  }
}
