import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { getPage, type PageName } from "@/lib/content";

import { MdxContent } from "./mdx-content";
import { OnlyGermanNote, PageIntro } from "./page-intro";

/** Einfache Textseite aus content/seiten/<name>.<sprache>.mdx */
export async function ContentPage({ name, locale }: { name: PageName; locale: Locale }) {
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
      <MdxContent source={page.body} lang={lang} />
    </div>
  );
}
