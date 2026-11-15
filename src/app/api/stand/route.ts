import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { loadSeasons, seasonsVersion } from "@/lib/season";

/*
 * Aktuelle Kennung der Spielplandaten für offene Seiten
 * (src/components/auto-refresh.tsx): /api/stand?sprache=de → { "version": "…" }. Weicht sie von der
 * Kennung der angezeigten Seite ab, holt der Browser die Seite neu.
 *
 * Die Daten kommen aus dem Fetch-Cache (Ligaseite höchstens alle zehn
 * Minuten beim Verband); das Ergebnis gilt 30 Sekunden.
 */

export const dynamic = "force-dynamic";

const shared = globalThis as unknown as { __stand?: Map<string, { at: number; version: string }> };
const memo = (shared.__stand ??= new Map());

export async function GET(request: Request) {
  const sprache = new URL(request.url).searchParams.get("sprache") ?? routing.defaultLocale;
  const locale = hasLocale(routing.locales, sprache) ? sprache : routing.defaultLocale;
  const cached = memo.get(locale);
  let version = cached && Date.now() - cached.at < 30_000 ? cached.version : undefined;
  if (!version) {
    try {
      version = seasonsVersion(await loadSeasons(locale));
      memo.set(locale, { at: Date.now(), version });
    } catch {
      return Response.json({ error: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }
  return Response.json({ version }, { headers: { "cache-control": "no-store" } });
}
