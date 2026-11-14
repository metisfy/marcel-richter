import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { getMatchday, matchdayDates, matchdayReport } from "@/lib/matchday";
import { loadSeasons } from "@/lib/season";

/*
 * Nur in der Entwicklung (npm run dev): liefert den automatischen
 * Spieltagsbericht als fertige MDX-Datei – Ausgangspunkt für einen eigenen
 * Bericht. Benutzt von scripts/spieltag-bericht.mjs:
 *
 *   npm run dev
 *   npm run bericht -- 2026-10-10        (legt content/spieltage/2026-10-10.de.mdx an)
 *
 * Im Produktionsbetrieb antwortet die Route immer mit 404.
 */

export const dynamic = "force-dynamic";

const quote = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export async function GET(request: Request, { params }: { params: Promise<{ datum: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const { datum } = await params;
  const locale = new URL(request.url).searchParams.get("sprache") ?? "de";
  if (!hasLocale(routing.locales, locale) || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return new Response("Ungültig", { status: 400 });

  for (const season of await loadSeasons(locale)) {
    if (!matchdayDates(season).includes(datum)) continue;
    const day = getMatchday(season, datum);
    if (!day) break;
    const report = matchdayReport(day, season, locale);
    const mdx = [
      "---",
      `title: ${quote(report.title)}`,
      `description: ${quote(report.paragraphs[0] ?? "")}`,
      "---",
      "",
      ...report.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ].join("\n");
    return new Response(mdx, { headers: { "content-type": "text/markdown; charset=utf-8" } });
  }
  return new Response(`Kein Spieltag am ${datum}`, { status: 404 });
}
