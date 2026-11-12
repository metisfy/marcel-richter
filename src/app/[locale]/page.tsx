import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { matchTitle, OutcomeBadge } from "@/components/fixtures";
import { ArrowRightIcon } from "@/components/icons";
import { ProjectCard } from "@/components/project-card";
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
import { formatDate, toIsoBerlin } from "@/lib/format";
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
    .slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="container-page grid items-center gap-10 overflow-x-clip pt-10 pb-16 sm:pt-16 md:grid-cols-[1.15fr_0.85fr] md:gap-14 md:pb-24">
        <div>
          <p className="eyebrow mb-4">
            {site.jobTitle} · {site.team.sport}
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {site.name}
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-relaxed text-pretty text-muted">{site.tagline}</p>
          <p className="mt-4 max-w-xl leading-relaxed text-pretty">{site.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/projekte" className="btn btn-primary">
              {t("ctaProjects")}
              <ArrowRightIcon width={18} height={18} />
            </Link>
            <Link href="/saison" className="btn btn-secondary">
              {t("ctaSeason")}
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm md:max-w-none">
          <div
            aria-hidden="true"
            className="absolute -inset-3 -z-10 rotate-3 rounded-[2rem] bg-accent-soft"
          />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-subtle shadow-xl">
            <Image
              src={site.portrait}
              alt={site.portraitAlt}
              fill
              priority
              sizes="(min-width: 768px) 420px, 90vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Saison auf einen Blick */}
      {season ? (
        <section aria-labelledby="saison-titel" className="border-y border-border bg-subtle/60 py-14">
          <div className="container-page">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">
                  {site.team.name} · {season.league}
                </p>
                <h2 id="saison-titel" className="text-3xl font-bold tracking-tight">
                  {t("seasonHeading", { season: season.season })}
                </h2>
              </div>
              <Link href="/saison" className="text-link">
                {t("ctaSeason")}
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-muted">{t("nextGame")}</h3>
                {upcoming ? (
                  <div className="mt-3">
                    <p className="text-lg font-semibold">
                      {matchTitle(upcoming, site.team.name).join(" – ")}
                    </p>
                    <p className="mt-1 text-muted">
                      <time dateTime={toIsoBerlin(upcoming.date)}>
                        {formatDate(upcoming.date, locale, { weekday: true })}
                      </time>
                      {upcoming.venue ? ` · ${upcoming.venue}` : null}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-muted">{t("noUpcoming")}</p>
                )}
              </div>

              <div className="card p-6">
                <h3 className="text-sm font-semibold text-muted">{t("lastResult")}</h3>
                {latest?.result && latest.outcome ? (
                  <div className="mt-3">
                    <p className="flex items-center gap-3 text-lg font-semibold">
                      <span>
                        {matchTitle(latest, site.team.name).join(" – ")}{" "}
                        <span className="tabular-nums">
                          {latest.result.home}:{latest.result.away}
                        </span>
                      </span>
                      <OutcomeBadge outcome={latest.outcome} locale={locale} />
                    </p>
                    <p className="mt-1 text-muted">
                      <time dateTime={toIsoBerlin(latest.date)}>
                        {formatDate(latest.date, locale, { time: false })}
                      </time>
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-muted">{t("noResult")}</p>
                )}
              </div>

              <div className="card p-6">
                <h3 className="text-sm font-semibold text-muted">{t("standing")}</h3>
                {season.standing ? (
                  <div className="mt-3">
                    <p className="text-4xl font-bold tracking-tight tabular-nums">
                      {season.standing.position}.
                    </p>
                    <p className="mt-1 text-muted">
                      {tSeason("standingValue", season.standing)}
                      {season.standing.points !== undefined
                        ? ` · ${tSeason("points", { points: season.standing.points })}`
                        : null}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-muted">–</p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Projekte */}
      {featured.length > 0 ? (
        <section aria-labelledby="projekte-titel" className="container-page py-16 md:py-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="projekte-titel" className="text-3xl font-bold tracking-tight">
              {t("projectsHeading")}
            </h2>
            <Link href="/projekte" className="text-link">
              {t("allProjects")}
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((project) => (
              <ProjectCard key={project.slug} project={project} locale={locale} headingLevel="h3" />
            ))}
          </div>
        </section>
      ) : null}

      {/* Fotos */}
      {photos.length > 0 ? (
        <section aria-labelledby="fotos-titel" className="container-page pb-16 md:pb-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="fotos-titel" className="text-3xl font-bold tracking-tight">
              {t("photosHeading")}
            </h2>
            <Link href="/fotos" className="text-link">
              {t("allPhotos")}
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {photos.map((photo) => (
              <li key={photo.src} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-subtle">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Kontakt */}
      <section aria-labelledby="kontakt-titel" className="container-page">
        <div className="rounded-3xl bg-accent px-6 py-12 text-accent-fg sm:px-12 sm:py-16">
          <h2 id="kontakt-titel" className="text-3xl font-bold tracking-tight">
            {t("contactHeading")}
          </h2>
          <p className="mt-3 max-w-xl text-lg opacity-90">{t("contactText")}</p>
          <Link
            href="/kontakt"
            className="btn mt-8 bg-accent-fg text-accent hover:opacity-90"
          >
            {t("contactCta")}
            <ArrowRightIcon width={18} height={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
