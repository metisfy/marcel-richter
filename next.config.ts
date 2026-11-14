import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Content-Security-Policy für statische Seiten (ohne Nonces, siehe
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
// Skripte, Styles, Bilder, Schriften und Verbindungen nur von dieser Domain.
// 'unsafe-inline' braucht Next.js für die eingebetteten Seitendaten und das
// Theme-Skript im <head>. Bewusst ohne upgrade-insecure-requests, damit die
// Seite auch intern über http://<ip>:3100 vollständig lädt.
const isDev = process.env.NODE_ENV === "development";
// Optionale Besucherstatistik (src/lib/analytics.ts): deren Adresse zulassen
const analyticsOrigin = (() => {
  try {
    const src = process.env.NEXT_PUBLIC_UMAMI_SRC?.trim();
    return src && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim() ? new URL(src).origin : "";
  } catch {
    return "";
  }
})();
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${analyticsOrigin ? ` ${analyticsOrigin}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Schlankes Server-Bundle für das Docker-Image: Next.js legt unter
  // .next/standalone eine server.js samt der wirklich benötigten
  // node_modules ab. Die Runner-Stage im Dockerfile baut darauf auf.
  output: "standalone",

  // Das Projekt ist die Wurzel, nicht der Ordner darüber (sonst sucht sich
  // Next.js wegen fremder Lockfiles im Elternordner einen falschen Root).
  outputFileTracingRoot: path.join(__dirname),

  // Inhalte werden beim Build gelesen. Zur Sicherheit liegen sie auch im
  // Image, falls eine Seite doch einmal zur Laufzeit gerendert wird.
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },

  // WICHTIG für den Standalone-Server (Docker): Ohne diese Zeile gibt
  // Next.js 16 dem Proxy (src/proxy.ts) die Adresse als „localhost“, vergleicht
  // dessen Rewrite danach aber mit der Adresse, auf der der Server lauscht
  // (0.0.0.0). Der Sprach-Rewrite /projekte → /de/projekte gilt dann als
  // „extern“: Ergebnis ist eine 307-Endlosschleife bzw. hinter dem Reverse
  // Proxy (X-Forwarded-Proto: https) ein 500er. `next dev`/`next start` sind
  // nicht betroffen – der Fehler zeigt sich nur im Container.
  skipProxyUrlNormalize: true,

  poweredByHeader: false,

  images: {
    formats: ["image/avif", "image/webp"],
    // Fotos ändern sich nur mit einem neuen Deployment → lange cachen.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Bilder aus public/images ändern ihren Namen nicht bei jeder
        // Änderung, deshalb nur einen Tag cachen.
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
