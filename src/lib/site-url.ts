/**
 * Öffentliche Basis-URL der Seite, z. B. https://www.marcel-richter.de.
 *
 * Wird beim Docker-Build aus der GitHub-Variable SITE_URL gesetzt
 * (Build-Arg → NEXT_PUBLIC_SITE_URL) und landet in Canonical-Links,
 * hreflang, Open-Graph-Bildern, Sitemap und strukturierten Daten.
 * Lokal fällt sie auf localhost zurück.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000"
).replace(/\/+$/, "");

/** Ist eine echte Domain gesetzt? Ohne sie wird die Seite nicht indexiert (robots). */
export const SITE_URL_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim());

export function absoluteUrl(pathname: string): string {
  if (/^https?:\/\//.test(pathname)) return pathname;
  return `${SITE_URL}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}
