/**
 * Admin-Bereich – auseinandergehalten allein am Host (wie bei t-orga):
 *
 *   admin.<domain>/…        → src/app/admin/…  (Segment unsichtbar)
 *   <server-ip>:3100/admin  → src/app/admin/…  (Segment sichtbar)
 *
 * `src/proxy.ts` schreibt auf dem Admin-Host jeden Pfad in `/admin/…` um.
 * Auf der öffentlichen Domain (SITE_URL) gibt es `/admin` nicht, auf jedem
 * anderen Host (Server-IP, localhost) bleibt es über das Segment erreichbar,
 * damit es sich auch ohne DNS einrichten lässt.
 *
 * Bewusst ohne Node-APIs – diese Datei lädt auch der Proxy.
 */

export const ADMIN_SEGMENT = "/admin";

/** Host-Kopf normalisieren: Port weg, klein. Hinter einem Reverse Proxy zählt der weitergereichte Host. */
export function hostFrom(headers: { get(name: string): string | null }): string {
  return (headers.get("x-forwarded-host") || headers.get("host") || "").split(",")[0].trim().split(":")[0].toLowerCase();
}

/** admin.marcel-richter.de, admin.localhost (zeigt im Browser von selbst auf 127.0.0.1) */
export function isAdminHost(host: string): boolean {
  return host.startsWith("admin.");
}

/** Die öffentliche Website (mit und ohne www) – dort gibt es keinen Admin-Bereich. */
export function isPublicHost(host: string): boolean {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return false;
  try {
    const site = new URL(configured).hostname.toLowerCase();
    const bare = site.replace(/^www\./, "");
    return host === site || host === bare || host === `www.${bare}`;
  } catch {
    return false;
  }
}

/** Link-Präfix im Admin-Bereich: leer auf dem Admin-Host, sonst das Segment. */
export function adminPrefixFor(host: string): string {
  return isAdminHost(host) ? "" : ADMIN_SEGMENT;
}

/** Wo der Admin-Bereich öffentlich liegt, z. B. https://admin.marcel-richter.de */
export function adminUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return `${url.protocol}//admin.${url.hostname.replace(/^www\./, "")}`;
  } catch {
    return null;
  }
}
