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

export function absoluteUrl(pathname: string): string {
  if (/^https?:\/\//.test(pathname)) return pathname;
  return `${SITE_URL}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}
