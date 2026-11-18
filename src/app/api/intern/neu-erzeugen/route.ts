import { timingSafeEqual } from "node:crypto";

import { revalidatePath } from "next/cache";

import { internalToken } from "@/lib/admin/internal";

/*
 * Alle öffentlichen Seiten beim nächsten Aufruf neu erzeugen. Ruft nur der
 * Server selbst nach dem Start auf (src/instrumentation.ts), wenn im
 * Admin-Bereich etwas vom Standard abweicht – die Seiten aus dem Build kennen
 * die Schalter (versteckte Projekte, Suchmaschinen) noch nicht.
 */

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  const given = Buffer.from(request.headers.get("x-intern") ?? "");
  const expected = Buffer.from(internalToken());
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response(null, { status: 404 });
  revalidatePath("/", "layout");
  revalidatePath("/sitemap.xml");
  return new Response(null, { status: 204 });
}
