import Image from "next/image";
import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { getPage, type PageName } from "@/lib/content";

import { MdxContent } from "./mdx-content";
import { OnlyGermanNote, PageIntro } from "./page-intro";

/**
 * Einfache Textseite aus content/seiten/<name>.<sprache>.mdx, optional mit
 * Bild rechts neben dem Text (auf dem Handy über dem Text).
 */
export async function ContentPage({
  name,
  locale,
  image,
}: {
  name: PageName;
  locale: Locale;
  image?: { src: string; alt: string };
}) {
  const page = getPage(name, locale);
  const t = await getTranslations("language");
  const fallback = page.contentLocale !== locale;
  const lang = fallback ? page.contentLocale : undefined;

  return (
    <div className="container-page">
      <div lang={lang}>
        <PageIntro title={page.title} />
      </div>
      {fallback ? <OnlyGermanNote text={t("onlyGerman")} /> : null}
      {image ? (
        <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-16">
          <div className="order-2 lg:order-1">
            <MdxContent source={page.body} lang={lang} />
          </div>
          <figure
            data-reveal="right"
            className="card relative order-1 aspect-[4/5] w-full max-w-xs overflow-hidden bg-surface shadow-soft lg:sticky lg:top-24 lg:order-2 lg:max-w-none lg:self-start"
          >
            <Image src={image.src} alt={image.alt} fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 320px, 320px" className="object-cover" />
          </figure>
        </div>
      ) : (
        <MdxContent source={page.body} lang={lang} />
      )}
    </div>
  );
}
