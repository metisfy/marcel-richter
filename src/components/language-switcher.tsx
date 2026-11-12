"use client";

import NextLink from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { getPathname } from "@/i18n/navigation";
import { resolveInternalPathname } from "@/i18n/resolve-pathname";
import { routing } from "@/i18n/routing";

type Href = Parameters<typeof getPathname>[0]["href"];

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const t = useTranslations("language");

  // Gleiche Seite in der anderen Sprache: interne Route + aktuelle Parameter
  // (z. B. der Projekt-Slug) → übersetzter Pfad. Unbekannte Seiten (404)
  // verlinken auf die Startseite der Zielsprache.
  const internal = resolveInternalPathname(pathname, locale) ?? "/";
  const routeParams = Object.fromEntries(Object.entries(params).filter(([key]) => key !== "locale"));
  const hrefFor = (target: (typeof routing.locales)[number]) => {
    try {
      return getPathname({ locale: target, href: { pathname: internal, params: routeParams } as Href });
    } catch {
      // z. B. 404 unter /projekte/<unbekannt>: Route erkannt, aber ohne
      // gültige Parameter → Startseite der Zielsprache.
      return getPathname({ locale: target, href: "/" });
    }
  };

  return (
    <ul aria-label={t("label")} className="flex items-center rounded-full border border-border p-0.5 text-sm font-semibold">
      {routing.locales.map((target) => (
        <li key={target}>
          <NextLink
            href={hrefFor(target)}
            prefetch={false}
            lang={target}
            hrefLang={target}
            aria-current={target === locale ? "true" : undefined}
            className="flex h-9 min-w-10 items-center justify-center rounded-full px-2.5 text-muted hover:text-fg aria-[current=true]:bg-fg aria-[current=true]:text-bg"
          >
            {target.toUpperCase()}
            <span className="sr-only"> – {t(target)}</span>
          </NextLink>
        </li>
      ))}
    </ul>
  );
}
