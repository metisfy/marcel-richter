import { getSeasons, getSite } from "@/lib/content";
import { liveMatchday } from "@/lib/live";

/*
 * Live-Stand eines Spieltags für den Browser: /api/live/<JJJJ-MM-TT>
 * Fragt den BVV-Live-Ticker nur für gestern, heute und morgen an
 * (src/lib/live.ts); für alle anderen Tage kommt sofort eine leere Antwort.
 */

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

function nearToday(date: string): boolean {
  const day = (offset: number) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(Date.now() + offset * 86_400_000));
  return [day(-1), day(0), day(1)].includes(date);
}

export async function GET(_request: Request, { params }: { params: Promise<{ datum: string }> }) {
  const { datum } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return Response.json({ error: "Ungültiges Datum" }, { status: 400, headers: NO_STORE });
  if (!nearToday(datum)) return Response.json({ matches: [] }, { headers: NO_STORE });

  // Nur in der Entwicklung zum Testen: LIVE_TEST_TEAM="<Teamname>" npm run dev
  const testTeam = process.env.NODE_ENV === "development" ? process.env.LIVE_TEST_TEAM : undefined;
  const source = getSeasons("de")[0]?.source;
  const team = testTeam ?? source?.team ?? getSite("de").team.name;
  try {
    const matches = await liveMatchday(team, datum, testTeam ? undefined : source?.ticker);
    return Response.json({ matches, updatedAt: Date.now() }, { headers: NO_STORE });
  } catch {
    return Response.json({ matches: [], error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
}
