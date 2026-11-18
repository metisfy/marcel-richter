/**
 * Öffentliche Basis-URL der Seite: https://marcel-richter.com.au
 *
 * Steht als Standard hier im Code (eine Domain ist kein Geheimnis). Die
 * GitHub-Variable SITE_URL bzw. NEXT_PUBLIC_SITE_URL (z. B. lokal
 * http://localhost:3000 in .env.local) überschreibt sie. Landet in
 * Canonical-Links, hreflang, Open-Graph-Bildern, Sitemap und strukturierten
 * Daten.
 *
 * Ohne Node-APIs – diese Datei lädt auch der Proxy.
 */
export const DEFAULT_SITE_URL = "https://marcel-richter.com.au";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, "");

/** Echte Domain (nicht localhost)? Nur dann dürfen Suchmaschinen indexieren. */
export const SITE_URL_CONFIGURED = !/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(SITE_URL);

/** Hostname der Website ohne www, z. B. marcel-richter.com.au */
export const SITE_HOST = new URL(SITE_URL).hostname.replace(/^www\./, "");

export function absoluteUrl(pathname: string): string {
  if (/^https?:\/\//.test(pathname)) return pathname;
  return `${SITE_URL}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
}
