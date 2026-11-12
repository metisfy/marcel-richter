import { getTranslations } from "next-intl/server";

import { Gallery } from "@/components/gallery";
import { PageIntro } from "@/components/page-intro";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { getAlbums, getSite } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const t = await getTranslations({ locale, namespace: "photos" });
  return pageMetadata({
    locale,
    href: "/fotos",
    title: t("title"),
    description: t("description"),
    ogKey: "fotos",
    siteName: getSite(locale).name,
  });
}

export default async function PhotosPage({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const t = await getTranslations("photos");
  const albums = getAlbums(locale);

  const labels = {
    open: t("open"),
    close: t("close"),
    previous: t("previous"),
    next: t("next"),
    // Platzhalter bleiben für die Client-Komponente erhalten.
    position: t.raw("position") as string,
  };

  return (
    <div className="container-page">
      <PageIntro title={t("title")} lead={t("lead")} />
      {albums.length === 0 ? <p className="text-muted">{t("empty")}</p> : null}
      <div className="space-y-20">
        {albums.map((album) => (
          <section key={album.slug} aria-labelledby={`album-${album.slug}`}>
            <div className="section-head mb-4">
              <h2 id={`album-${album.slug}`} className="display text-4xl sm:text-5xl">
                {album.title}
              </h2>
              <p className="text-sm text-muted">
                <time dateTime={album.date}>{formatDate(album.date, locale, { time: false, month: "long" })}</time>
                {" · "}
                {t("count", { count: album.photos.length })}
              </p>
            </div>
            {album.description ? <p className="mb-6 max-w-2xl text-muted">{album.description}</p> : null}
            <Gallery photos={album.photos} title={album.title} labels={labels} />
          </section>
        ))}
      </div>
    </div>
  );
}
