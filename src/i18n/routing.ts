import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de", "en"],
  defaultLocale: "de",
  // Deutsch ohne Präfix (/projekte), Englisch mit (/en/projects).
  localePrefix: "as-needed",
  // Kein Umleiten anhand der Browsersprache und kein Sprach-Cookie:
  // „/“ ist immer Deutsch, die Seite setzt keinerlei Cookies.
  localeDetection: false,
  localeCookie: false,
  // Interne Routen (Ordnernamen unter src/app/[locale]) → öffentliche URLs.
  pathnames: {
    "/": "/",
    "/ueber-mich": { de: "/ueber-mich", en: "/about" },
    "/projekte": { de: "/projekte", en: "/projects" },
    "/projekte/[slug]": { de: "/projekte/[slug]", en: "/projects/[slug]" },
    "/fotos": { de: "/fotos", en: "/photos" },
    "/saison": { de: "/saison", en: "/season" },
    "/kontakt": { de: "/kontakt", en: "/contact" },
    "/impressum": { de: "/impressum", en: "/legal-notice" },
    "/datenschutz": { de: "/datenschutz", en: "/privacy" },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
