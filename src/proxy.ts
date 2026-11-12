import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Ordnet jede Anfrage einer Sprache zu und schreibt die öffentlichen,
// übersetzten Pfade intern auf die Ordnerstruktur um
// (/en/projects → /en/projekte). Die Seiten selbst bleiben statisch.
export default createMiddleware(routing);

export const config = {
  // Nicht durch den Proxy: API (Healthcheck), OG-Bilder, Next-Interna und
  // alles mit Dateiendung (Bilder, robots.txt, sitemap.xml, icon.svg …).
  matcher: ["/((?!api|og|_next|_vercel|.*\\..*).*)"],
};
