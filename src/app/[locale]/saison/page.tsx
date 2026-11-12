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

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {season.standing ? (
        <div className="card col-span-2 bg-accent p-5 text-accent-fg sm:col-span-1">
          <dt className="text-sm font-semibold opacity-90">{t("standing")}</dt>
          <dd className="mt-1">
            <span className="text-3xl font-bold tabular-nums">{season.standing.position}.</span>
            <span className="mt-1 block text-sm opacity-90">
              {t("standingValue", season.standing)}
              {season.standing.points !== undefined
                ? ` · ${t("points", { points: season.standing.points })}`
                : null}
            </span>
          </dd>
        </div>
      ) : null}
      {season.stats.map((stat) => (
        <div key={stat.label} className="card p-5">
          <dt className="text-sm font-semibold text-muted">{stat.label}</dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums">{stat.value}</dd>
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

      <section aria-labelledby="statistik" className="mb-14">
        <h2 id="statistik" className="mb-5 text-2xl font-bold tracking-tight">
          {t("stats")}
        </h2>
        <SeasonFacts season={current} />
      </section>

      <section aria-labelledby="spielplan" className="mb-14">
        <h2 id="spielplan" className="mb-5 text-2xl font-bold tracking-tight">
          {t("fixtures")}
        </h2>
        <FixtureTable fixtures={current.fixtures} season={current.season} teamName={site.team.name} locale={locale} />
      </section>

      {previous.length > 0 ? (
        <section aria-labelledby="archiv">
          <h2 id="archiv" className="mb-5 text-2xl font-bold tracking-tight">
            {t("archive")}
          </h2>
          <div className="space-y-3">
            {previous.map((season) => (
              <details key={season.id} className="card group p-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 font-semibold [&::-webkit-details-marker]:hidden">
                  <span>
                    {t("heading", { season: season.season })}
                    <span className="ml-2 font-normal text-muted">· {season.league}</span>
                  </span>
                  <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="space-y-6 border-t border-border p-5">
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
