import Image from "next/image";
import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";

import { matchPlace, matchTitle, OutcomeBadge, SetScores } from "@/components/fixtures";
import { ArrowRightIcon, CalendarIcon, CheckIcon } from "@/components/icons";
import { SectionHead } from "@/components/page-intro";
import { ProjectCard } from "@/components/project-card";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getProjects, getSite, lastResult, nextMatchday, ownSets, roleLine, type Season } from "@/lib/content";
import { formatShortDate, formatTime, toIsoBerlin } from "@/lib/format";
import { loadCurrentSeason } from "@/lib/season";
import { pageMetadata } from "@/lib/seo";

// Das Saison-Fenster zeigt Live-Daten vom BVV: höchstens stündlich neu bauen
// (siehe src/lib/season.ts). Muss eine Zahl sein, kein Ausdruck.
export const revalidate = 3600;

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

/**
 * Saison als „Fenster“ unter der Hauptüberschrift – angelehnt an die
 * Produktvorschau auf metisone.de. Links das letzte Spiel mit den Sätzen als
 * Balken, rechts nächstes Spiel und Tabellenplatz.
 */
async function SeasonWindow({ season, locale }: { season: Season; locale: Locale }) {
  const t = await getTranslations("home");
  const tSeason = await getTranslations("season");
  const tMatchday = await getTranslations("matchday");
  const matchday = nextMatchday(season);
  const upcoming = matchday[0];
  const latest = lastResult(season);
  const places = upcoming ? await Promise.all(matchday.map(matchPlace)) : [];

  // Sätze aus eigener Sicht: [eigene Punkte, Punkte des Gegners]
  const sets = latest ? ownSets(latest) : [];
  const max = Math.max(25, ...sets.flat());

  return (
    <div className="card mx-auto max-w-[60rem] overflow-hidden text-left shadow-soft">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#febc2e]" />
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#28c840]" />
        <h2 className="ml-3 truncate font-mono text-[12px] text-muted">
          {t("seasonWindow", { season: season.season })} · {season.league}
        </h2>
        {season.source?.updatedAt ? (
          <span className="ml-auto hidden shrink-0 items-center gap-2 font-mono text-[11.5px] text-muted sm:inline-flex">
            <span aria-hidden="true" className="live-dot" />
            {t("live")}
          </span>
        ) : null}
      </div>

      <div className="grid md:grid-cols-[1.35fr_1fr]">
        <div className="border-b border-line p-6 sm:p-7 md:border-r md:border-b-0">
          <h3 className="eyebrow">{t("lastResult")}</h3>
          {latest?.result && latest.outcome ? (
            <>
              <p className="mt-3 flex items-center gap-3">
                <span className="text-4xl font-semibold tracking-[-0.02em] tabular-nums">{latest.result.join(":")}</span>
                <OutcomeBadge outcome={latest.outcome} />
                {latest.appearance?.status === "played" ? (
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line px-2.5 font-mono text-[11.5px] text-muted">
                    <CheckIcon width={11} height={11} strokeWidth={3} className="text-win" />
                    {t("lastPlayed")}
                  </span>
                ) : null}
              </p>
              <p className="mt-1.5 text-[15px] text-muted">
                {matchTitle(latest)}
                <span className="sr-only"> ({formatShortDate(latest.date, locale)})</span>
              </p>
              <Link
                href={{ pathname: "/saison/[datum]", params: { datum: latest.date.slice(0, 10) }, hash: latest.number ? `spiel-${latest.number}` : undefined }}
                className="arrow-link mt-2 text-[14.5px]"
              >
                {tMatchday("toReport")}
              </Link>

              {sets.length > 0 ? (
                <div className="mt-7">
                  <SetScores sets={latest.sets} className="sr-only" />
                  <div aria-hidden="true" className="flex h-32 items-end gap-2.5 sm:gap-4">
                    {sets.map(([own, other], index) => (
                      <div key={index} className="flex h-full flex-1 flex-col justify-end">
                        <div className="flex flex-1 items-end justify-center gap-1">
                          {/* Balken wachsen nacheinander aus der Grundlinie (.bar-grow) */}
                          <span
                            className={`bar-grow w-full max-w-5 rounded-t-[4px] ${own > other ? "bg-accent-bright" : "bg-accent-bright/35"}`}
                            style={{ height: `${(own / max) * 100}%`, "--delay": `${0.6 + index * 0.09}s` } as CSSProperties}
                          />
                          <span
                            className="bar-grow w-full max-w-5 rounded-t-[4px] bg-surface-2"
                            style={{ height: `${(other / max) * 100}%`, "--delay": `${0.65 + index * 0.09}s` } as CSSProperties}
                          />
                        </div>
                        <span className="mt-2 text-center font-mono text-[11px] text-muted tabular-nums">
                          {own}:{other}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-muted">{t("noResult")}</p>
          )}
        </div>

        <div className="divide-y divide-line">
          <div className="p-6 sm:p-7">
            <h3 className="eyebrow">{matchday.length > 1 ? t("nextMatchday") : t("nextGame")}</h3>
            {upcoming ? (
              <>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.02em]">
                  <time dateTime={toIsoBerlin(upcoming.date)}>{formatShortDate(upcoming.date, locale)}</time>
                  {formatTime(upcoming.date, locale) ? (
                    <span className="ml-2 font-mono text-sm font-normal text-muted">{formatTime(upcoming.date, locale)}</span>
                  ) : null}
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[15px] font-medium">
                  {matchday.map((fixture) => (
                    <li key={`${fixture.date}-${fixture.opponent}`}>{matchTitle(fixture)}</li>
                  ))}
                </ul>
                <p className="mt-1 text-sm text-muted">{places[0]}</p>
                <Link href={{ pathname: "/saison/[datum]", params: { datum: upcoming.date.slice(0, 10) } }} className="arrow-link mt-2 text-[14.5px]">
                  {tMatchday("toPreview")}
                </Link>
              </>
            ) : (
              <p className="mt-3 text-muted">{t("noUpcoming")}</p>
            )}
          </div>
          <div className="p-6 sm:p-7">
            <h3 className="eyebrow">{t("standing")}</h3>
            {season.standing ? (
              <p className="mt-3 flex items-baseline gap-3">
                <span className="text-4xl font-semibold tracking-[-0.02em] text-accent tabular-nums">
                  {season.standing.position}.
                </span>
                <span className="text-[15px] text-muted">
                  {tSeason("of", { teams: season.standing.teams })}
                  {season.standing.points !== undefined ? ` · ${tSeason("points", { points: season.standing.points })}` : null}
                </span>
              </p>
            ) : (
              <p className="mt-3 text-muted">–</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const t = await getTranslations("home");
  const tPlayer = await getTranslations("player");
  const site = getSite(locale);
  const season = await loadCurrentSeason(locale);

  const projects = getProjects(locale);
  const featured = [
    ...projects.filter((project) => project.featured),
    ...projects.filter((project) => !project.featured),
  ].slice(0, 3);

  const nameParts = site.name.split(" ");
  const lastName = nameParts.length > 1 ? nameParts.pop() : undefined;
  const roster = [
    { label: tPlayer("position"), value: site.team.position },
    { label: tPlayer("number"), value: site.team.number !== undefined ? `#${site.team.number}` : undefined },
    { label: tPlayer("club"), value: site.team.name },
    { label: tPlayer("league"), value: site.team.league },
    {
      label: tPlayer("appearances"),
      value: season?.appearances ? t("appearancesCount", { count: season.appearances.played, season: season.season }) : undefined,
    },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <>
      {/* Kopf: zentriert wie auf metisone.de */}
      {/* -mt-16/pt-16: Der Kopfbereich reicht unter die (oben durchsichtige)
          Kopfzeile, damit der Farbverlauf bis an den oberen Rand läuft. */}
      <section className="relative isolate -mt-16 overflow-x-clip pt-16">
        {/* Schwebende Farbflächen statt eines starren Verlaufs */}
        <div aria-hidden="true" className="hero-blobs">
          <span className="blob blob-a" />
          <span className="blob blob-b" />
          <span className="blob blob-c" />
        </div>
        <div className="container-page pt-16 pb-14 text-center sm:pt-24 sm:pb-16">
          <p className="badge rise">
            <span aria-hidden="true" className="badge-dot" />
            {roleLine(site)}
          </p>
          <h1 className="mt-7 text-[clamp(3rem,0.9rem+8.6vw,6.5rem)] leading-[0.98] font-bold tracking-[-0.03em]">
            <span className="rise-focus block [--delay:0.04s]">{nameParts.join(" ")}</span>
            {lastName ? (
              <span className="rise-focus block pb-[0.08em] [--delay:0.1s]">
                {" "}
                <span className="gradient-text">{lastName}</span>
              </span>
            ) : null}
          </h1>
          <p className="rise mx-auto mt-6 max-w-[38rem] text-[clamp(1.0625rem,1rem+0.3vw,1.1875rem)] leading-relaxed text-pretty text-muted [--delay:0.2s]">
            {site.tagline}
          </p>
          <div className="rise mt-9 flex flex-wrap justify-center gap-3 [--delay:0.27s]">
            <Link href="/projekte" className="btn btn-dark">
              {t("ctaProjects")}
              <ArrowRightIcon width={17} height={17} />
            </Link>
            {season ? (
              <Link href="/saison" className="btn btn-ghost">
                <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-surface-2">
                  <CalendarIcon width={13} height={13} />
                </span>
                {t("ctaSeason", { season: season.season })}
              </Link>
            ) : null}
          </div>
        </div>

        {season ? (
          <div className="rise container-page pb-16 sm:pb-20 [--delay:0.36s]">
            <SeasonWindow season={season} locale={locale} />
          </div>
        ) : null}
      </section>

      {/* Leiste mit Häkchen */}
      {roster.length > 0 ? (
        <div className="border-y border-line bg-surface">
          <ul data-reveal-stagger className="container-page flex flex-wrap justify-center gap-x-8 gap-y-2 py-4 text-[14.5px] text-muted">
            {roster.map((item) => (
              <li key={item.label} className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="grid size-[18px] place-items-center rounded-full bg-accent-soft text-accent">
                  <CheckIcon width={11} height={11} strokeWidth={3} />
                </span>
                <span className="sr-only">{item.label}: </span>
                {item.value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Über mich: Porträt, Text, nummerierte Karten */}
      <section aria-labelledby="ueber-titel" className="container-page py-20 sm:py-24">
        <div className="grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div data-reveal="left" className="card relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden bg-surface shadow-soft lg:max-w-none">
            <Image
              src={site.portrait}
              alt={site.portraitAlt}
              fill
              sizes="(min-width: 1024px) 440px, (min-width: 448px) 448px, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <div data-reveal="right">
              <p className="eyebrow">{t("aboutEyebrow")}</p>
              <h2 id="ueber-titel" className="h2 mt-3.5">
                {site.jobTitle}.
              </h2>
              <p className="mt-5 text-[16.5px] leading-relaxed text-muted">{site.intro}</p>
            </div>

            {site.highlights.length > 0 ? (
              <ol data-reveal-stagger className="mt-8 space-y-3">
                {site.highlights.map((item, index) => (
                  <li key={item.title} className="card flex gap-4 p-5 transition-[translate,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-accent-bright/40 hover:shadow-soft sm:p-6">
                    <span aria-hidden="true" className="pt-0.5 font-mono text-[13px] font-medium text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-1 text-[15px] leading-relaxed text-muted">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}

            <Link href="/ueber-mich" className="arrow-link mt-8" data-reveal>
              {t("aboutLink")}
            </Link>
          </div>
        </div>
      </section>

      {/* Projekte als graues Band */}
      {featured.length > 0 ? (
        <section aria-labelledby="projekte-titel" className="border-y border-line bg-surface py-20 sm:py-24">
          <div className="container-page">
            <SectionHead
              eyebrow={t("projectsHeading")}
              title={t("projectsTitle")}
              id="projekte-titel"
              action={
                <Link href="/projekte" className="arrow-link">
                  {t("allProjects")}
                </Link>
              }
            />
            <div data-reveal-stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((project) => (
                <ProjectCard key={project.slug} project={project} locale={locale} headingLevel="h3" />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Kontakt */}
      <section aria-labelledby="kontakt-titel" data-reveal="zoom" className="container-page pt-4 text-center">
        <h2 id="kontakt-titel" className="text-[clamp(2rem,1.4rem+2.4vw,3rem)] leading-tight font-semibold tracking-[-0.02em]">
          {t("ctaTitle")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-muted">{t("contactText")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={`mailto:${site.email}`} className="btn btn-primary">
            {t("ctaMail")}
            <ArrowRightIcon width={17} height={17} />
          </a>
          <Link href="/kontakt" className="btn btn-ghost">
            {t("contactCta")}
          </Link>
        </div>
      </section>
    </>
  );
}
