import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { ADMIN_SEGMENT, hostFrom, isAdminHost, isPublicHost } from "./lib/admin/hosts";

// Ordnet jede Anfrage einer Sprache zu und schreibt die öffentlichen,
// übersetzten Pfade intern auf die Ordnerstruktur um
// (/en/projects → /en/projekte). Die Seiten selbst bleiben statisch.
const intl = createMiddleware(routing);

/*
 * Davor die Host-Weiche für den Admin-Bereich (src/lib/admin/hosts.ts):
 *
 *   admin.<domain>/nachrichten  → src/app/admin/nachrichten (Segment unsichtbar)
 *   <server-ip>:3100/admin/…    → src/app/admin/…           (Segment sichtbar)
 *   <öffentliche Domain>/admin  → 404 der Website
 *
 * Verbindlich geprüft wird die Anmeldung erst in den Seiten und Aktionen
 * (src/lib/admin/guard.ts) – der Proxy entscheidet nur über den Weg.
 */
function adminResponse(response: NextResponse): NextResponse {
  // Der Admin-Bereich gehört in keine Suchmaschine
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export default function proxy(request: NextRequest) {
  const host = hostFrom(request.headers);
  const path = request.nextUrl.pathname;
  const inSegment = path === ADMIN_SEGMENT || path.startsWith(`${ADMIN_SEGMENT}/`);

  if (isAdminHost(host)) {
    // Zweiter Durchlauf nach dem Umschreiben: durchlassen, sonst Schleife
    if (inSegment) return adminResponse(NextResponse.next());
    const url = request.nextUrl.clone();
    url.pathname = path === "/" ? ADMIN_SEGMENT : `${ADMIN_SEGMENT}${path}`;
    return adminResponse(NextResponse.rewrite(url));
  }

  if (inSegment && !isPublicHost(host)) return adminResponse(NextResponse.next());

  return intl(request);
}

export const config = {
  // Nicht durch den Proxy: API (Healthcheck), OG-Bilder, Next-Interna und
  // alles mit Dateiendung (Bilder, robots.txt, sitemap.xml, icon.svg …).
  matcher: ["/((?!api|og|_next|_vercel|.*\\..*).*)"],
};
