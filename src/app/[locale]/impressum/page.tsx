import { ContentPage } from "@/components/content-page";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { getPage, getSite } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const page = getPage("impressum", locale);
  return pageMetadata({
    locale,
    href: "/impressum",
    title: page.title,
    description: page.description,
    ogKey: "impressum",
    siteName: getSite(locale).name,
  });
}

export default async function ImpressumPage({ params }: LocaleParams) {
  const locale = await initLocale(params);
  return <ContentPage name="impressum" locale={locale} />;
}
