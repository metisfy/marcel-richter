import type { Locale } from "@/i18n/routing";

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

function parts(value: string) {
  const [day, time] = value.split(" ");
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time ? time.split(":").map(Number) : [0, 0];
  return { year, month, date, hour, minute, hasTime: Boolean(time) };
}

/**
 * Datumsangaben in den Inhaltsdateien sind deutsche Ortszeit ohne Zeitzone.
 * Für die Anzeige wird die Wanduhrzeit 1:1 übernommen (Formatierung in UTC),
 * damit Build-Server-Zeitzone und Sommerzeit keine Rolle spielen.
 */
export function formatDate(
  value: string,
  locale: Locale,
  options: { weekday?: boolean; time?: boolean; month?: "long" | "short" | "2-digit" } = {},
): string {
  const p = parts(value);
  const showTime = (options.time ?? true) && p.hasTime;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    weekday: options.weekday ? "short" : undefined,
    day: "numeric",
    month: options.month ?? "long",
    year: "numeric",
    hour: showTime ? "2-digit" : undefined,
    minute: showTime ? "2-digit" : undefined,
  }).format(new Date(Date.UTC(p.year, p.month - 1, p.date, p.hour, p.minute)));
}

/**
 * Wochentag, Tag und Monat für kompakte Spielpläne:
 * „Sa 14.11.“ bzw. „Sat 14/11“ (ohne das „Sa.,“ von Intl).
 */
export function formatShortDate(value: string, locale: Locale): string {
  const p = parts(value);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.date));
  const weekday = new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", weekday: "short" })
    .format(date)
    .replace(/\.$/, "");
  const day = String(p.date).padStart(2, "0");
  const month = String(p.month).padStart(2, "0");
  return locale === "de" ? `${weekday} ${day}.${month}.` : `${weekday} ${day}/${month}`;
}

export function formatTime(value: string, locale: Locale): string | undefined {
  const p = parts(value);
  if (!p.hasTime) return undefined;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Date.UTC(p.year, p.month - 1, p.date, p.hour, p.minute)));
}

/**
 * ISO-8601 mit dem für dieses Datum gültigen Berliner Offset
 * (für strukturierte Daten und <time datetime>).
 */
export function toIsoBerlin(value: string): string {
  const p = parts(value);
  const day = `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.date).padStart(2, "0")}`;
  if (!p.hasTime) return day;
  const instant = new Date(Date.UTC(p.year, p.month - 1, p.date, p.hour, p.minute));
  const zone =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Berlin",
      timeZoneName: "longOffset",
    })
      .formatToParts(instant)
      .find((part) => part.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+00:00";
  const time = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  return `${day}T${time}:00${zone}`;
}
