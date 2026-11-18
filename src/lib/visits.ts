import { createHash, randomBytes } from "node:crypto";

/*
 * Besucherstatistik, Teil 1: Erfassen (POST /api/besuch).
 *
 * Ein winziges Skript (src/components/visit-beacon.tsx) meldet jeden
 * Seitenaufruf – auch Wechsel innerhalb der Seite, die ohne Anfrage an den
 * Server auskommen – ohne Cookies an den eigenen Server. Nicht gezählt
 * werden Bots und Besucher mit „Do Not Track“/„Global Privacy Control“.
 * Gemerkt werden nur
 *
 *   Tag · Seite · Domain der Herkunftsseite · Geräteklasse (aus dem User-Agent)
 *
 * und eine Prüfsumme aus IP-Adresse, User-Agent und einem täglich neuen
 * Zufallswert, um Besucher je Tag nur einmal zu zählen. Der Zufallswert liegt
 * nur im Arbeitsspeicher und wird täglich verworfen – damit lässt sich die
 * Prüfsumme keiner Person mehr zuordnen. Die IP-Adresse selbst wird nirgends
 * gespeichert.
 *
 * Teil 2 (src/lib/admin/statistics.ts) schreibt die gesammelten Aufrufe alle
 * paar Sekunden zusammengefasst in die Datenbank.
 */

export type Visit = { day: string; path: string; source?: string; device: "mobil" | "tablet" | "desktop"; visitor: string };

type Shared = { __visitQueue?: Visit[]; __visitSalt?: { day: string; salt: string } };
const shared = globalThis as unknown as Shared;

/** Warteschlange, die Proxy und Server-Code gemeinsam benutzen (gleicher Prozess). */
export function visitQueue(): Visit[] {
  return (shared.__visitQueue ??= []);
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\/|httpclient|scrapy/i;

export const berlinDay = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

function dailySalt(day: string): string {
  if (shared.__visitSalt?.day !== day) shared.__visitSalt = { day, salt: randomBytes(16).toString("hex") };
  return shared.__visitSalt.salt;
}

function deviceOf(userAgent: string): Visit["device"] {
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(userAgent)) return "mobil";
  return "desktop";
}

/**
 * Prüft den gemeldeten Aufruf und legt ihn, wenn er zählt, in die
 * Warteschlange. `path` ist der öffentliche Pfad (z. B. /en/projects),
 * `referrer` die Herkunftsseite (nur beim ersten Aufruf eines Besuchs).
 */
export function recordVisit(headers: Headers, path: string, referrer: string, ownHosts: string[]): void {
  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1") return;
  const userAgent = headers.get("user-agent") ?? "";
  if (!userAgent || BOT.test(userAgent)) return;

  let source: string | undefined;
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
      if (host && !ownHosts.includes(host) && !host.startsWith("admin.")) source = host.slice(0, 100);
    } catch {
      /* ungültige Herkunft: weglassen */
    }
  }

  const ip = headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "";
  const day = berlinDay();
  const visitor = createHash("sha256").update(`${dailySalt(day)}|${ip}|${userAgent}`).digest("hex").slice(0, 32);

  const queue = visitQueue();
  // Notbremse, falls die Datenbank länger nicht erreichbar ist
  if (queue.length > 5000) return;
  queue.push({ day, path: (path.replace(/\/+$/, "") || "/").slice(0, 200), source, device: deviceOf(userAgent), visitor });
}
