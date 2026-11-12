import type { Metadata } from "next";

import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

import { absoluteUrl } from "./site-url";

type Href = Parameters<typeof getPathname>[0]["href"];

/** Absolute, übersetzte URL einer Route, z. B. https://…/en/projects. */
export function localizedUrl(locale: Locale, href: Href): string {
  return absoluteUrl(getPathname({ locale, href }));
}

const OG_LOCALE: Record<Locale, string> = { de: "de_DE", en: "en_GB" };

/**
 * Einheitliche Metadaten je Seite: Titel, Beschreibung, Canonical,
 * hreflang-Alternativen und Open-Graph/Twitter mit dem passenden
 * OG-Bild aus /og/<sprache>/<schlüssel>.
 */
export function pageMetadata({
  locale,
  href,
  title,
  description,
  ogKey,
  siteName,
  type = "website",
  absoluteTitle = false,
}: {
  locale: Locale;
  href: Href;
  title: string;
  description: string;
  ogKey: string;
  siteName: string;
  type?: "website" | "article" | "profile";
  absoluteTitle?: boolean;
}): Metadata {
  const url = localizedUrl(locale, href);
  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((l) => [l, localizedUrl(l, href)]),
  );
  languages["x-default"] = localizedUrl(routing.defaultLocale, href);
  const image = {
    url: absoluteUrl(`/og/${locale}/${ogKey}`),
    width: 1200,
    height: 630,
    alt: title,
  };

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type,
      url,
      title,
      description,
      siteName,
      locale: OG_LOCALE[locale],
      alternateLocale: routing.locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALE[l]),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}
