import { hostFrom } from "@/lib/admin/hosts";
import { sameOrigin } from "@/lib/contact";
import { SITE_HOST } from "@/lib/site-url";
import { recordVisit } from "@/lib/visits";
import { websiteSettings } from "@/lib/website-settings";

/*
 * Besucherstatistik: Meldung eines Seitenaufrufs vom Beacon
 * (src/components/visit-beacon.tsx). Antwortet immer 204 – der Browser
 * wartet auf nichts, und Fremde erfahren nichts.
 */

export const dynamic = "force-dynamic";

const done = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  if (!websiteSettings().statistics || !sameOrigin(request.headers)) return done();
  const raw = await request.text();
  if (raw.length > 2000) return done();
  let body: { p?: unknown; r?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return done();
  }
  if (typeof body.p !== "string" || !body.p.startsWith("/") || body.p.startsWith("/admin") || body.p.startsWith("/api")) return done();
  const path = body.p.split(/[?#]/)[0];
  recordVisit(request.headers, path, typeof body.r === "string" ? body.r : "", [SITE_HOST, hostFrom(request.headers).replace(/^www\./, "")]);
  return done();
}
