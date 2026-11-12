/**
 * Healthcheck für Docker und die Deploy-Pipeline.
 *
 * Beantwortet nur „läuft der Prozess, und welcher Commit ist das?“ –
 * kein Rendern, keine Inhalte. Die Pipeline vergleicht `version` mit dem
 * gerade ausgerollten Commit und erkennt so, ob wirklich die neue Fassung
 * live ist und nicht noch der alte Container antwortet.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok", version: process.env.GIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
