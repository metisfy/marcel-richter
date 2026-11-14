import { getTranslations } from "next-intl/server";

import { CalendarLinks } from "@/components/calendar-links";
import { LiveTodayPanel } from "@/components/live";
import { FixtureTable, LeagueTable, SourceNote } from "@/components/fixtures";
import { RankingChart } from "@/components/match";
import { JsonLd } from "@/components/json-ld";
import { PageIntro, SectionHead } from "@/components/page-intro";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import { getSite, type Season } from "@/lib/content";
import { loadSeasons } from "@/lib/season";
import { pageMetadata } from "@/lib/seo";
import { seasonEvents } from "@/lib/structured-data";

// Spielplan und Tabelle kommen live vom BVV: alle fünf Minuten neu bauen (Daten selbst: Fetch-Cache, siehe src/lib/season.ts)
// (siehe src/lib/season.ts). Muss eine Zahl sein, kein Ausdruck.
export const revalidate = 300;

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const t = await getTranslations({ locale, namespace: "season" });
  return pageMetadata({
    locale,
    href: "/saison",
    title: t("title"),
    description: t("description"),
    ogKey: "saison",
    siteName: getSite(locale).name,
  });
}

async function SeasonFacts({ season }: { season: Season }) {
  const t = await getTranslations("season");
  const facts = [
    ...(season.record
      ? [
          { label: t("played"), value: season.record.played },
          { label: t("won"), value: season.record.won },
          { label: t("lost"), value: season.record.lost },
          { label: t("setsShort"), value: season.record.sets },
        ]
      : []),
    ...season.stats,
  ];
  if (!season.standing && facts.length === 0) return null;

  return (
    <dl data-reveal-stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {season.standing ? (
        <div className="card col-span-2 border-transparent bg-accent-soft p-5 sm:col-span-1">
          <dt className="eyebrow">{t("standing")}</dt>
          <dd className="mt-2">
            <span className="block text-4xl font-semibold tracking-[-0.02em] text-accent tabular-nums">
              {season.standing.position}.
            </span>
            <span className="mt-1 block text-sm text-muted">
              {t("of", { teams: season.standing.teams })}
              {season.standing.points !== undefined ? ` · ${t("points", { points: season.standing.points })}` : null}
            </span>
          </dd>
        </div>
      ) : null}
      {season.appearances ? (
        <div className="card col-span-2 border-transparent bg-win-soft p-5 sm:col-span-1">
          <dt className="eyebrow">{t("appearances")}</dt>
          <dd className="mt-2">
            <span className="block text-4xl font-semibold tracking-[-0.02em] text-win tabular-nums">{season.appearances.played}</span>
            <span className="mt-1 block text-sm text-muted">{t("appearancesOf", { matches: season.appearances.matches })}</span>
          </dd>
        </div>
      ) : null}
      {facts.map((fact) => (
        <div key={fact.label} className="card p-5">
          <dt className="eyebrow">{fact.label}</dt>
          <dd className="mt-2 text-[clamp(1.75rem,1.4rem+1vw,2.25rem)] font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums">
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function SeasonPage({ params }: LocaleParams) {
  const locale: Locale = await initLocale(params);
  const t = await getTranslations("season");
  const site = getSite(locale);
  const [current, ...previous] = await loadSeasons(locale);

  if (!current) {
    return (
      <div className="container-page">
        <PageIntro title={t("title")} lead={t("none")} />
      </div>
    );
  }

  return (
    <div className="container-page">
      {current.fixtures.length > 0 ? <JsonLd data={seasonEvents(site, current, locale)} /> : null}
      <PageIntro
        eyebrow={`${site.team.name} · ${current.league}`}
        title={t("heading", { season: current.season })}
        lead={current.summary}
      />

      {/* Live-Ticker am Spieltag – unabhängig von den Saisondaten des BVV */}
      <LiveTodayPanel ownTeam={current.source?.team ?? site.team.name} />

      <section aria-labelledby="statistik" className="mb-20">
        <h2 id="statistik" className="sr-only">
          {t("stats")}
        </h2>
        <SeasonFacts season={current} />
        {current.ranking.length > 0 ? (
          <div className="mt-3">
            <RankingChart ranking={current.ranking} teams={current.standing?.teams ?? current.table.length} locale={locale} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="spielplan" className="mb-20">
        <SectionHead eyebrow={t("heading", { season: current.season })} title={t("fixtures")} id="spielplan" />
        {current.source && !current.source.updatedAt ? null : (
          <FixtureTable fixtures={current.fixtures} season={current.season} locale={locale} />
        )}
        {current.source ? <SourceNote source={current.source} locale={locale} /> : null}
        {current.fixtures.length > 0 ? (
          <CalendarLinks
            path={locale === "de" ? "/spielplan.ics" : "/fixtures.ics"}
            labels={{ title: t("calendarTitle"), text: t("calendarText"), subscribe: t("calendarSubscribe"), google: t("calendarGoogle"), download: t("calendarDownload") }}
          />
        ) : null}
      </section>

      {current.table.length > 0 ? (
        <section aria-labelledby="tabelle" className="mb-20">
          <SectionHead eyebrow={current.league} title={t("table")} id="tabelle" />
          <LeagueTable rows={current.table} league={current.league} />
        </section>
      ) : null}

      {previous.length > 0 ? (
        <section aria-labelledby="archiv">
          <SectionHead title={t("archive")} id="archiv" />
          <div className="space-y-3">
            {previous.map((season) => (
              <details key={season.id} data-reveal className="card group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="font-semibold">{t("heading", { season: season.season })}</span>
                    <span className="ml-3 text-muted">{season.league}</span>
                  </span>
                  <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg border border-line text-lg text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="space-y-6 border-t border-line p-5 sm:p-6">
                  {season.summary ? <p className="max-w-2xl text-muted">{season.summary}</p> : null}
                  <SeasonFacts season={season} />
                  <FixtureTable fixtures={season.fixtures} season={season.season} locale={locale} />
                  {season.table.length > 0 ? <LeagueTable rows={season.table} league={season.league} /> : null}
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
