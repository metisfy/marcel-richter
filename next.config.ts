import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
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
