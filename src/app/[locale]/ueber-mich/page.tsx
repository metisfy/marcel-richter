import { getTranslations } from "next-intl/server";

import { ContentPage } from "@/components/content-page";
import { JsonLd } from "@/components/json-ld";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { getPage, getSite } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbs, profilePage } from "@/lib/structured-data";

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const page = getPage("ueber-mich", locale);
  return pageMetadata({
    locale,
    href: "/ueber-mich",
    title: page.title,
    description: page.description,
    ogKey: "ueber-mich",
    siteName: getSite(locale).name,
  });
}

export default async function UeberMichPage({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const site = getSite(locale);
  const page = getPage("ueber-mich", locale);
  const t = await getTranslations("nav");
  return (
    <>
      <JsonLd data={profilePage(site, locale, page)} />
      <JsonLd
        data={breadcrumbs(locale, [
          { name: t("home"), href: "/" },
          { name: t("about"), href: "/ueber-mich" },
        ])}
      />
      <ContentPage name="ueber-mich" locale={locale} image={{ src: site.portrait, alt: site.portraitAlt }} />
    </>
  );
}
