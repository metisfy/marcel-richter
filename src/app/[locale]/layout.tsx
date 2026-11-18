import "../globals.css";

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/json-ld";
import { RevealObserver } from "@/components/reveal-observer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { VisitBeacon } from "@/components/visit-beacon";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { ANALYTICS } from "@/lib/analytics";
import { getSite } from "@/lib/content";
import { fontVariables } from "@/lib/fonts";
import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";
import { siteGraph } from "@/lib/structured-data";
import { themeInitScript } from "@/lib/theme-script";
import { websiteSettings } from "@/lib/website-settings";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initLocale(params);
  const site = getSite(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.tagline,
    applicationName: site.name,
    authors: [{ name: site.name, url: SITE_URL }],
    creator: site.name,
    formatDetection: { telephone: false, email: false, address: false },
    // Ohne eigene Domain (GitHub-Variable SITE_URL) zeigten Canonical-Links
    // auf localhost – dann lieber gar nicht indexieren.
    // Schalter „Suchmaschinen“ im Admin-Bereich; zusätzlich setzt der Proxy
    // bei „aus“ X-Robots-Tag: noindex für jede Antwort (src/proxy.ts)
    robots: SITE_URL_CONFIGURED && websiteSettings().indexing
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
      : { index: false, follow: false },
    // Bestätigung für Google Search Console / Bing Webmaster Tools
    // (GitHub-Variablen GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION)
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e11" },
  ],
  colorScheme: "light dark",
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const locale = await initLocale(params);
  const site = getSite(locale);
  const t = await getTranslations("nav");

  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#inhalt" className="skip-link">
          {t("skip")}
        </a>
        <NextIntlClientProvider>
          <SiteHeader name={site.name} number={site.team.number} />
          <main id="inhalt" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter site={site} />
        </NextIntlClientProvider>
        <JsonLd data={siteGraph(site, locale)} />
        <RevealObserver />
        <VisitBeacon />
        {/* Besucherstatistik nur, wenn beim Build eingeschaltet (src/lib/analytics.ts) */}
        {ANALYTICS ? (
          <Script src={ANALYTICS.src} data-website-id={ANALYTICS.websiteId} data-do-not-track="true" strategy="afterInteractive" />
        ) : null}
      </body>
    </html>
  );
}
