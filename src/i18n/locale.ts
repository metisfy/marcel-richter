import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "./routing";

export type LocaleParams = { params: Promise<{ locale: string }> };

/**
 * Prüft die Sprache aus der URL und aktiviert sie für next-intl.
 * setRequestLocale ist nötig, damit die Seiten statisch generiert werden
 * können (statt bei jedem Aufruf dynamisch).
 */
export async function initLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
