import { loadSeasons, toSnapshot } from "@/lib/season";

/*
 * Nur in der Entwicklung (npm run dev): die aktuellen BVV-Daten aller
 * Saisons als „letzter bekannter Stand“. Benutzt von scripts/bvv-stand.mjs:
 *
 *   npm run dev
 *   npm run bvv:stand          (schreibt content/saison/<saison>.bvv.json)
 *
 * Antwortet der Verband beim Build nicht, baut die Website mit diesen Daten
 * statt ohne Spielplan. Im Produktionsbetrieb antwortet die Route mit 404.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const seasons = await loadSeasons("de");
  return Response.json(
    seasons
      .filter((season) => season.source)
      .map((season) => ({ id: season.id, error: season.source?.error, snapshot: toSnapshot(season) })),
  );
}
