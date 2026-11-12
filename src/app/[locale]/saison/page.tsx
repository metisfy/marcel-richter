import { getTranslations } from "next-intl/server";

import { FixtureTable } from "@/components/fixtures";
import { JsonLd } from "@/components/json-ld";
import { PageIntro } from "@/components/page-intro";
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

  // gap-px auf farbigem Grund ergibt feine Trennlinien, egal wie die
  // Kacheln umbrechen.
  return (
    <dl className="grid grid-cols-2 gap-px border-y-[3px] border-rule bg-border sm:grid-cols-3 lg:grid-cols-6">
      {season.standing ? (
        <div className="col-span-2 bg-signal p-4 text-signal-fg sm:col-span-1 sm:p-5">
          <dt className="label">{t("standing")}</dt>
          <dd className="mt-2">
            <span className="display block text-6xl tabular-nums">{season.standing.position}.</span>
            <span className="mt-2 block text-sm font-medium">
              {t("of", { teams: season.standing.teams })}
              {season.standing.points !== undefined
                ? ` · ${t("points", { points: season.standing.points })}`
                : null}
            </span>
          </dd>
        </div>
      ) : null}
      {season.stats.map((stat) => (
        <div key={stat.label} className="bg-bg p-4 sm:p-5">
          <dt className="label text-muted">{stat.label}</dt>
          <dd className="display mt-2 text-6xl tabular-nums">{stat.value}</dd>
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

      <section aria-labelledby="statistik" className="mb-16">
        <h2 id="statistik" className="sr-only">
          {t("stats")}
        </h2>
        <SeasonFacts season={current} />
      </section>

      <section aria-labelledby="spielplan" className="mb-16">
        <div className="section-head mb-2">
          <h2 id="spielplan" className="display text-4xl sm:text-5xl">
            {t("fixtures")}
          </h2>
        </div>
        <FixtureTable fixtures={current.fixtures} season={current.season} teamName={site.team.name} locale={locale} />
      </section>

      {previous.length > 0 ? (
        <section aria-labelledby="archiv">
          <div className="section-head mb-0">
            <h2 id="archiv" className="display text-4xl sm:text-5xl">
              {t("archive")}
            </h2>
          </div>
          <div>
            {previous.map((season) => (
              <details key={season.id} className="group border-b border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="condensed text-2xl">{t("heading", { season: season.season })}</span>
                    <span className="ml-3 text-muted">{season.league}</span>
                  </span>
                  <span aria-hidden="true" className="display text-3xl text-accent transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="space-y-8 pb-8">
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
