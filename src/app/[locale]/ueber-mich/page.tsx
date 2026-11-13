import { ContentPage } from "@/components/content-page";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { getPage, getSite } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

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
  return <ContentPage name="ueber-mich" locale={locale} image={{ src: site.portrait, alt: site.portraitAlt }} />;
}
