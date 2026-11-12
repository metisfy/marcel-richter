import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { matchTitle, OutcomeBadge, SetScores } from "@/components/fixtures";
import { ArrowRightIcon } from "@/components/icons";
import { ProjectRow } from "@/components/project-card";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import {
  currentSeason,
  getAlbums,
  getProjects,
  getSite,
  lastResult,
  nextFixture,
} from "@/lib/content";
import { formatShortDate, formatTime, toIsoBerlin } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const site = getSite(locale);
  return pageMetadata({
    locale,
    href: "/",
    title: `${site.name} – ${site.jobTitle}`,
    description: site.tagline,
    ogKey: "home",
    siteName: site.name,
    type: "profile",
    absoluteTitle: true,
  });
}

export default async function HomePage({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const t = await getTranslations("home");
  const tSeason = await getTranslations("season");
  const tPlayer = await getTranslations("player");
  const site = getSite(locale);
  const season = currentSeason(locale);
  const upcoming = nextFixture(season);
  const latest = lastResult(season);

  const projects = getProjects(locale);
  const featured = [
    ...projects.filter((project) => project.featured),
    ...projects.filter((project) => !project.featured),
  ].slice(0, 3);
  const photos = getAlbums(locale)
    .flatMap((album) => album.photos)
    .slice(0, 5);

  const nameParts = site.name.split(" ");
  const roster = [
    { label: tPlayer("position"), value: site.team.position },
    { label: tPlayer("number"), value: site.team.number?.toString() },
    { label: tPlayer("club"), value: site.team.name },
    { label: tPlayer("league"), value: site.team.league },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <>
      {/* Kopf: Name, Kurzvorstellung, Kaderzeile, Porträt */}
      <section className="container-page grid gap-10 pt-8 pb-16 sm:pt-12 md:grid-cols-12 md:gap-8 md:pb-24">
        <div className="flex flex-col md:col-span-7 md:pt-4">
          <h1 className="display text-[clamp(4.25rem,15vw,10rem)] leading-[0.84]">
            {nameParts.map((part, index) => (
              <span key={part} className="block">
                {part}
                {index < nameParts.length - 1 ? " " : null}
              </span>
            ))}
          </h1>
          <p className="mt-7 max-w-xl text-xl leading-snug text-pretty sm:text-[1.375rem]">{site.tagline}</p>
          <p className="mt-3 max-w-xl text-pretty text-muted">{site.intro}</p>

          {roster.length > 0 ? (
            <dl className="mt-8 grid grid-cols-2 border-t-[3px] border-rule sm:grid-cols-4">
              {roster.map((item) => (
                <div key={item.label} className="border-b border-border py-3 pr-3 sm:border-b-0">
                  <dt className="label text-muted">{item.label}</dt>
                  <dd className="mt-1 font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link href="/projekte" className="btn btn-primary">
              {t("ctaProjects")}
              <ArrowRightIcon width={18} height={18} />
            </Link>
            {season ? (
              <Link href="/saison" className="text-link">
                {t("ctaSeason", { season: season.season })}
              </Link>
            ) : null}
          </div>
        </div>

        <figure className="relative mx-auto w-full max-w-md md:col-span-5 md:max-w-none">
          <div className="relative aspect-[4/5] overflow-hidden bg-subtle">
            <Image
              src={site.portrait}
              alt={site.portraitAlt}
              fill
              priority
              sizes="(min-width: 1216px) 470px, (min-width: 768px) 40vw, 90vw"
              className="object-cover"
            />
          </div>
          {site.team.number !== undefined ? (
            <span
              aria-hidden="true"
              className="display absolute bottom-0 left-0 bg-signal px-4 pt-3 pb-2 text-7xl text-signal-fg tabular-nums"
            >
              {site.team.number}
            </span>
          ) : null}
        </figure>
      </section>

      {/* Saison wie auf einer Anzeigetafel */}
      {season ? (
        <section aria-labelledby="saison-titel" className="bg-board text-board-fg">
          <div className="container-page py-10 md:py-12">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-board-rule pb-4">
              <h2 id="saison-titel" className="display text-3xl sm:text-4xl">
                {t("seasonHeading", { season: season.season })}
              </h2>
              <p className="text-sm text-board-muted">
                {site.team.name} · {season.league}
              </p>
            </div>

            <div className="grid divide-y divide-board-rule md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="py-6 md:pr-8">
                <h3 className="label text-board-muted">{t("nextGame")}</h3>
                {upcoming ? (
                  <>
                    <p className="display mt-3 text-5xl tabular-nums">
                      <time dateTime={toIsoBerlin(upcoming.date)}>{formatShortDate(upcoming.date, locale)}</time>
                    </p>
                    <p className="mt-3 font-semibold">{matchTitle(upcoming, site.team.name).join(" – ")}</p>
                    <p className="mt-1 text-sm text-board-muted">
                      {[formatTime(upcoming.date, locale), upcoming.home ? tSeason("home") : tSeason("away"), upcoming.venue]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-board-muted">{t("noUpcoming")}</p>
                )}
              </div>

              <div className="py-6 md:px-8">
                <h3 className="label text-board-muted">{t("lastResult")}</h3>
                {latest?.result && latest.outcome ? (
                  <>
                    <p className="mt-3 flex items-center gap-3">
                      <span className="display text-5xl tabular-nums">
                        {latest.result.home}:{latest.result.away}
                      </span>
                      <OutcomeBadge outcome={latest.outcome} locale={locale} />
                    </p>
                    <p className="mt-3 font-semibold">{matchTitle(latest, site.team.name).join(" – ")}</p>
                    <p className="mt-1 text-sm text-board-muted">
                      <SetScores sets={latest.sets} />
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-board-muted">{t("noResult")}</p>
                )}
              </div>

              <div className="py-6 md:pl-8">
                <h3 className="label text-board-muted">{t("standing")}</h3>
                {season.standing ? (
                  <>
                    <p className="display mt-3 text-5xl text-board-accent tabular-nums">{season.standing.position}.</p>
                    <p className="mt-3 font-semibold">{tSeason("of", { teams: season.standing.teams })}</p>
                    {season.standing.points !== undefined ? (
                      <p className="mt-1 text-sm text-board-muted">
                        {tSeason("points", { points: season.standing.points })}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 text-board-muted">–</p>
                )}
              </div>
            </div>

            <Link
              href="/saison"
              className="mt-2 inline-flex items-center gap-2 font-semibold underline decoration-board-accent decoration-2 underline-offset-[5px] hover:text-board-accent"
            >
              {t("allFixtures")}
              <ArrowRightIcon width={16} height={16} />
            </Link>
          </div>
        </section>
      ) : null}

      {/* Projekte */}
      {featured.length > 0 ? (
        <section aria-labelledby="projekte-titel" className="container-page pt-16 md:pt-24">
          <div className="section-head mb-0">
            <h2 id="projekte-titel" className="display text-4xl sm:text-5xl">
              {t("projectsHeading")}
            </h2>
            <Link href="/projekte" className="text-link">
              {t("allProjects")}
            </Link>
          </div>
          <div>
            {featured.map((project) => (
              <ProjectRow key={project.slug} project={project} locale={locale} headingLevel="h3" />
            ))}
          </div>
        </section>
      ) : null}

      {/* Fotos: ein großes, vier kleine */}
      {photos.length > 0 ? (
        <section aria-labelledby="fotos-titel" className="container-page pt-16 md:pt-24">
          <div className="section-head">
            <h2 id="fotos-titel" className="display text-4xl sm:text-5xl">
              {t("photosHeading")}
            </h2>
            <Link href="/fotos" className="text-link">
              {t("allPhotos")}
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <li
                key={photo.src}
                className={`relative aspect-square overflow-hidden bg-subtle ${index === 0 ? "col-span-2 row-span-2" : ""}`}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes={index === 0 ? "(min-width: 1216px) 580px, (min-width: 640px) 50vw, 100vw" : "(min-width: 1216px) 290px, 25vw"}
                  className="object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Kontakt */}
      <section aria-labelledby="kontakt-titel" className="container-page pt-16 md:pt-24">
        <div className="section-head">
          <h2 id="kontakt-titel" className="display text-4xl sm:text-5xl">
            {t("contactHeading")}
          </h2>
          <Link href="/kontakt" className="text-link">
            {t("contactCta")}
          </Link>
        </div>
        <a
          href={`mailto:${site.email}`}
          className="condensed inline-block text-[clamp(2.25rem,7vw,5rem)] leading-none break-all underline decoration-signal decoration-[3px] underline-offset-[0.12em] hover:text-accent"
        >
          {site.email}
        </a>
        <p className="mt-5 max-w-xl text-muted">{t("contactText")}</p>
      </section>
    </>
  );
}
