import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { ADMIN_SEGMENT, hostFrom, isAdminHost, isPublicHost } from "./lib/admin/hosts";
import { websiteSettings } from "./lib/website-settings";

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
 * Und die Schalter aus dem Admin-Bereich (src/lib/website-settings.ts), die
 * hier bei jedem Aufruf wirken – unabhängig davon, wann eine Seite zuletzt
 * erzeugt wurde:
 *   - versteckte Projekte → 404
 *   - Suchmaschinen aus   → X-Robots-Tag: noindex
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

/** Projekt-Slug aus /projekte/<slug> bzw. /en/projects/<slug> */
function projectSlug(path: string): string | null {
  return path.match(/^\/(?:de\/)?projekte\/([^/]+)\/?$/)?.[1] ?? path.match(/^\/en\/projects\/([^/]+)\/?$/)?.[1] ?? null;
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

  const settings = websiteSettings();

  // Versteckte Projekte gibt es öffentlich nicht – auch nicht über einen alten Link
  const slug = projectSlug(path);
  if (slug && settings.hiddenProjects.includes(slug)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${path.startsWith("/en/") ? "en" : "de"}/projekte/__nicht-vorhanden`;
    return NextResponse.rewrite(url);
  }

  const response = intl(request);
  if (!settings.indexing) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Nicht durch den Proxy: API (Healthcheck), OG-Bilder, Next-Interna und
  // alles mit Dateiendung (Bilder, robots.txt, sitemap.xml, icon.svg …).
  matcher: ["/((?!api|og|_next|_vercel|.*\\..*).*)"],
};
