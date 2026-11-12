import "../globals.css";

import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { getSite } from "@/lib/content";
import { fontVariables } from "@/lib/fonts";
import { SITE_URL } from "@/lib/site-url";
import { siteGraph } from "@/lib/structured-data";
import { themeInitScript } from "@/lib/theme-script";

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
      </body>
    </html>
  );
}
