import { getSeasons } from "@/lib/content";
import { liveStatus, pingTicker } from "@/lib/live";
import { bvvStatus, snapshotDates } from "@/lib/season";

/*
 * Zustand der Datenquellen, zur Fehlersuche im Browser:
 *
 *   /api/status            was dieser Server zuletzt vom BVV und vom Ticker bekam
 *   /api/status?pruefen=1  zusätzlich jetzt beide Quellen anfragen (höchstens
 *                          einmal pro Minute, sonst kommt das letzte Ergebnis)
 *
 * Enthält keine Zugangsdaten und keine personenbezogenen Daten.
 */

export const dynamic = "force-dynamic";

type Check = { at: number; result: unknown };
const shared = globalThis as unknown as { __statusCheck?: Check };

async function ping(url: string) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; spielplan-abruf/1.0)" },
      signal: AbortSignal.timeout(60_000),
    });
    await response.body?.cancel();
    return { ok: response.ok, status: response.status, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: Request) {
  const check = new URL(request.url).searchParams.get("pruefen") === "1";
  if (check && (!shared.__statusCheck || Date.now() - shared.__statusCheck.at > 60_000)) {
    const url = getSeasons("de")[0]?.source?.url;
    const [bvv, ticker] = await Promise.all([url ? ping(url) : undefined, pingTicker()]);
    shared.__statusCheck = { at: Date.now(), result: { at: new Date().toISOString(), bvv, ticker } };
  }
  return Response.json(
    {
      version: process.env.GIT_SHA ?? "dev",
      now: new Date().toISOString(),
      bvv: { ...bvvStatus, lastKnownData: snapshotDates() },
      ticker: liveStatus(),
      check: shared.__statusCheck?.result,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
