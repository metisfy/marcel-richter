import { getTranslations } from "next-intl/server";

import { FixtureTable } from "@/components/fixtures";
import { JsonLd } from "@/components/json-ld";
import { PageIntro, SectionHead } from "@/components/page-intro";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import { getSeasons, getSite, type Season } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";
import { seasonEvents } from "@/lib/structured-data";

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
  if (!season.standing && season.stats.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
      {season.stats.map((stat) => (
        <div key={stat.label} className="card p-5">
          <dt className="eyebrow">{stat.label}</dt>
          <dd className="mt-2 text-4xl font-semibold tracking-[-0.02em] tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function SeasonPage({ params }: LocaleParams) {
  const locale: Locale = await initLocale(params);
  const t = await getTranslations("season");
  const site = getSite(locale);
  const [current, ...previous] = getSeasons(locale);

  if (!current) {
    return (
      <div className="container-page">
        <PageIntro title={t("title")} lead={t("none")} />
      </div>
    );
  }

  return (
    <div className="container-page">
      <JsonLd data={seasonEvents(site, current, locale)} />
      <PageIntro
        eyebrow={`${site.team.name} · ${current.league}`}
        title={t("heading", { season: current.season })}
        lead={current.summary}
      />

      <section aria-labelledby="statistik" className="mb-20">
        <h2 id="statistik" className="sr-only">
          {t("stats")}
        </h2>
        <SeasonFacts season={current} />
      </section>

      <section aria-labelledby="spielplan" className="mb-20">
        <SectionHead eyebrow={t("heading", { season: current.season })} title={t("fixtures")} id="spielplan" />
        <FixtureTable fixtures={current.fixtures} season={current.season} teamName={site.team.name} locale={locale} />
      </section>

      {previous.length > 0 ? (
        <section aria-labelledby="archiv">
          <SectionHead title={t("archive")} id="archiv" />
          <div className="space-y-3">
            {previous.map((season) => (
              <details key={season.id} className="card group">
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
                  <FixtureTable fixtures={season.fixtures} season={season.season} teamName={site.team.name} locale={locale} />
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
