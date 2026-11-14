/**
 * Optionale Besucherstatistik mit Umami (selbst gehostet, ohne Cookies).
 * Standardmäßig AUS. Eingeschaltet wird sie nur, wenn beide Variablen beim
 * Build gesetzt sind (GitHub-Variablen UMAMI_SRC und UMAMI_WEBSITE_ID →
 * Build-Args im Dockerfile):
 *
 *   NEXT_PUBLIC_UMAMI_SRC=https://statistik.example.com/script.js
 *   NEXT_PUBLIC_UMAMI_WEBSITE_ID=<Website-ID aus Umami>
 *
 * Dann wird das Skript geladen, die Content-Security-Policy um die Adresse
 * erweitert und die Datenschutzerklärung zeigt den Abschnitt dazu.
 * Vorher rechtlich prüfen lassen (README → „Besucherstatistik“).
 */
export const ANALYTICS = (() => {
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC?.trim();
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  if (!src || !websiteId) return undefined;
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return undefined;
    return { src: url.toString(), origin: url.origin, host: url.host, websiteId };
  } catch {
    return undefined;
  }
})();
