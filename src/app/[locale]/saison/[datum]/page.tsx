import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppearanceMark, MatchTeams, OutcomeBadge } from "@/components/fixtures";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, ExternalIcon } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { FormChips, SetBars, SetTable } from "@/components/match";
import { MdxContent } from "@/components/mdx-content";
import { initLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";
import { type Fixture, getMatchdayReport, getSite, type Season } from "@/lib/content";
import { formatDate, formatShortDate, formatTime } from "@/lib/format";
import {
  formOf,
  getMatchday,
  headToHead,
  type Matchday,
  matchdayDates,
  matchdayReport,
  matchStats,
  tableRowOf,
} from "@/lib/matchday";
import { loadSeasons } from "@/lib/season";
import { pageMetadata } from "@/lib/seo";
import { seasonEvents } from "@/lib/structured-data";

// Ergebnisse, Spielberichte und Tabellenplatz kommen live vom BVV: höchstens
// stündlich neu bauen (siehe src/lib/season.ts). Muss eine Zahl sein.
export const revalidate = 3600;

type Props = { params: Promise<{ locale: string; datum: string }> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Alle Spieltage aller Saisons beim Build vorbauen; neue Termine entstehen bei Bedarf. */
export async function generateStaticParams() {
  const params: { locale: string; datum: string }[] = [];
  for (const locale of routing.locales) {
    const seasons = await loadSeasons(locale);
    for (const datum of new Set(seasons.flatMap(matchdayDates))) params.push({ locale, datum });
  }
  return params;
}

async function find(locale: Locale, datum: string): Promise<{ season: Season; day: Matchday } | undefined> {
  if (!DATE.test(datum)) return undefined;
  for (const season of await loadSeasons(locale)) {
    const day = getMatchday(season, datum);
    if (day) return { season, day };
  }
  return undefined;
}

export async function generateMetadata({ params }: Props) {
  const locale = await initLocale(params);
  const { datum } = await params;
  const found = await find(locale, datum);
  if (!found) return {};
  const t = await getTranslations({ locale, namespace: "matchday" });
  const report = matchdayReport(found.day, found.season, locale);
  const custom = getMatchdayReport(datum, locale);
  const description = custom?.description ?? report.paragraphs.join(" ");
  return pageMetadata({
    locale,
    href: { pathname: "/saison/[datum]", params: { datum } },
    title: `${custom?.title ?? report.title} · ${t("matchdayOf", { date: formatDate(datum, locale) })}`,
    description: description.length > 160 ? `${description.slice(0, 157).replace(/\s+\S*$/, "")} …` : description,
    ogKey: "saison",
    siteName: getSite(locale).name,
    type: "article",
  });
}

/** Kachel in der Zahlenleiste */
function Fact({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: "accent" | "win" }) {
  const box = highlight === "accent" ? "border-transparent bg-accent-soft" : highlight === "win" ? "border-transparent bg-win-soft" : "";
  const color = highlight === "accent" ? "text-accent" : highlight === "win" ? "text-win" : "";
  return (
    <div className={`card p-5 ${box}`}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2">
        <span className={`block text-[clamp(1.5rem,1.2rem+0.8vw,1.875rem)] font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums ${color}`}>{value}</span>
        {sub ? <span className="mt-1 block text-sm text-muted">{sub}</span> : null}
      </dd>
    </div>
  );
}

async function PlayedMatch({ fixture, season, locale }: { fixture: Fixture; season: Season; locale: Locale }) {
  const t = await getTranslations("matchday");
  const stats = matchStats(fixture)!;
  const ownName = fixture.teams[fixture.own];
  const average = (stats.balls[0] / stats.sets.length).toFixed(1).replace(".", locale === "de" ? "," : ".");
  const others = headToHead(season, fixture);

  return (
    <div className="space-y-6 p-5 sm:p-6">
      <SetBars stats={stats} own={ownName} opponent={fixture.opponent} />
      <SetTable fixture={fixture} balls={fixture.details?.balls} />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-reveal-stagger>
        <div className="rounded-xl border border-line p-4">
          <dt className="eyebrow">{t("balls")}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{stats.balls.join(":")}</dd>
        </div>
        <div className="rounded-xl border border-line p-4">
          <dt className="eyebrow">{t("average")}</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{average}</dd>
        </div>
        {stats.closest ? (
          <div className="rounded-xl border border-line p-4">
            <dt className="eyebrow">{t("closest")}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {t("closestValue", { set: stats.closest.set, score: stats.closest.score.join(":") })}
            </dd>
          </div>
        ) : null}
        <div className="rounded-xl border border-line p-4">
          <dt className="eyebrow">{t("course")}</dt>
          <dd className="mt-1 font-mono text-[15px] font-medium tabular-nums">{stats.course.join(" → ")}</dd>
        </div>
      </dl>

      <dl className="divide-y divide-line border-y border-line text-[15px]">
        {fixture.appearance ? (
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">{t("myAppearance")}</dt>
            <dd className="flex items-center gap-2 text-right font-medium">
              <AppearanceMark appearance={fixture.appearance} />
              {fixture.appearance.status === "played"
                ? fixture.appearance.libero
                  ? null
                  : t("played")
                : fixture.appearance.status === "squad"
                  ? t("squadOnly")
                  : t("absent")}
            </dd>
          </div>
        ) : null}
        {fixture.details?.squad ? (
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">{t("squad")}</dt>
            <dd className="text-right font-medium">{t("squadValue", fixture.details.squad)}</dd>
          </div>
        ) : null}
        {fixture.details?.referee ? (
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">{t("referee")}</dt>
            <dd className="text-right font-medium">{fixture.details.referee}</dd>
          </div>
        ) : null}
      </dl>

      {others.length > 0 ? <HeadToHead fixtures={others} locale={locale} /> : null}
      {fixture.url ? <BvvLink url={fixture.url} /> : null}
    </div>
  );
}

async function UpcomingMatch({ fixture, season, locale }: { fixture: Fixture; season: Season; locale: Locale }) {
  const t = await getTranslations("matchday");
  const row = tableRowOf(season, fixture.opponent);
  const form = formOf(season, fixture.opponent);
  const others = headToHead(season, fixture).filter((other) => other.result);

  return (
    <div className="space-y-6 p-5 sm:p-6">
      <dl className="grid gap-3 sm:grid-cols-2" data-reveal-stagger>
        <div className="rounded-xl border border-line p-4">
          <dt className="eyebrow">{t("opponent")}</dt>
          <dd className="mt-1">
            <span className="block text-lg font-semibold">{fixture.opponent}</span>
            {row ? (
              <span className="mt-0.5 block text-sm text-muted">
                {t("standing", { position: row.position, teams: season.table.length })} · {t("record", { won: row.won, lost: row.lost, sets: row.sets })}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="rounded-xl border border-line p-4">
          <dt className="eyebrow">{t("form")}</dt>
          <dd className="mt-2">
            <FormChips form={form} locale={locale} />
          </dd>
        </div>
      </dl>
      {fixture.details?.referee ? (
        <dl className="flex items-center justify-between gap-4 border-y border-line py-3 text-[15px]">
          <dt className="text-muted">{t("referee")}</dt>
          <dd className="text-right font-medium">{fixture.details.referee}</dd>
        </dl>
      ) : null}
      {others.length > 0 ? <HeadToHead fixtures={others} locale={locale} /> : null}
      {fixture.url ? <BvvLink url={fixture.url} /> : null}
    </div>
  );
}

async function HeadToHead({ fixtures, locale }: { fixtures: Fixture[]; locale: Locale }) {
  const t = await getTranslations("matchday");
  return (
    <div>
      <h4 className="eyebrow">{t("headToHead")}</h4>
      <ul className="mt-3 space-y-2">
        {fixtures.map((other) => (
          <li key={`${other.date}-${other.number}`}>
            <Link
              href={{ pathname: "/saison/[datum]", params: { datum: other.date.slice(0, 10) }, hash: other.number ? `spiel-${other.number}` : undefined }}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-line px-4 py-3 transition-colors hover:bg-surface"
            >
              <span>
                <span className="font-mono text-[12.5px] text-muted">{formatShortDate(other.date, locale)}</span>{" "}
                <MatchTeams fixture={other} />
              </span>
              {other.result && other.outcome ? (
                <span className="inline-flex items-center gap-2">
                  <OutcomeBadge outcome={other.outcome} />
                  <span className="font-semibold tabular-nums">{other.result.join(":")}</span>
                </span>
              ) : (
                <span className="font-mono text-[12.5px] text-muted">{t("open")}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function BvvLink({ url }: { url: string }) {
  const t = await getTranslations("matchday");
  return (
    <a href={url} rel="noopener" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
      {t("bvv")}
      <ExternalIcon width={14} height={14} />
    </a>
  );
}

export default async function MatchdayPage({ params }: Props) {
  const locale = await initLocale(params);
  const { datum } = await params;
  const found = await find(locale, datum);
  if (!found) notFound();
  const { season, day } = found;

  const t = await getTranslations("matchday");
  const tSeason = await getTranslations("season");
  const site = getSite(locale);
  const report = matchdayReport(day, season, locale);
  const custom = getMatchdayReport(datum, locale);
  const stats = day.fixtures.map(matchStats);
  const played = stats.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const sum = (pick: (entry: (typeof played)[number]) => [number, number]) =>
    played.reduce<[number, number]>((total, entry) => [total[0] + pick(entry)[0], total[1] + pick(entry)[1]], [0, 0]);
  const known = day.fixtures.filter((fixture) => fixture.appearance);
  const city = day.venue?.city?.replace(/^\d{4,5}\s+/, "");
  const lead = [day.home ? t("homeMatchday") : day.host ? t("hostedBy", { team: day.host }) : undefined, day.venue ? [day.venue.name, city].filter(Boolean).join(", ") : undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="container-page">
      <JsonLd data={seasonEvents(site, { ...season, fixtures: day.fixtures }, locale)} />

      <nav aria-label={t("eyebrow")} className="flex items-center justify-between gap-4 pt-8">
        <Link href="/saison" className="inline-flex items-center gap-1.5 font-medium text-muted hover:text-fg">
          <ArrowLeftIcon width={16} height={16} />
          {t("back")}
        </Link>
        <div className="flex items-center gap-2">
          {day.previous ? (
            <Link href={{ pathname: "/saison/[datum]", params: { datum: day.previous } }} className="icon-btn" title={t("previous")}>
              <span className="sr-only">{t("previous")}</span>
              <ChevronLeftIcon width={18} height={18} />
            </Link>
          ) : null}
          {day.next ? (
            <Link href={{ pathname: "/saison/[datum]", params: { datum: day.next } }} className="icon-btn" title={t("next")}>
              <span className="sr-only">{t("next")}</span>
              <ChevronRightIcon width={18} height={18} />
            </Link>
          ) : null}
        </div>
      </nav>

      <header className="max-w-3xl pt-8 pb-10">
        <p className="eyebrow rise mb-4">
          {t("eyebrow")} · {formatDate(datum, locale, { weekday: true })}
          {day.time ? ` · ${formatTime(day.fixtures[0].date, locale)}` : ""}
        </p>
        <h1 className="rise-focus text-[clamp(2rem,1.4rem+2.6vw,3rem)] leading-[1.08] font-semibold tracking-[-0.02em] text-balance [--delay:0.06s]">
          {custom?.title ?? report.title}
        </h1>
        {lead ? <p className="rise mt-5 text-lg leading-relaxed text-pretty text-muted [--delay:0.14s]">{lead}</p> : null}
      </header>

      {/* Zahlenleiste */}
      <section aria-label={t("summary")} className="mb-12">
        {played.length > 0 ? (
          <dl data-reveal-stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Fact label={t("wins")} value={`${played.filter((entry) => entry.result[0] > entry.result[1]).length}/${played.length}`} />
            <Fact label={t("dayPoints")} value={played.reduce((total, entry) => total + entry.points, 0)} />
            <Fact label={t("sets")} value={sum((entry) => entry.result).join(":")} />
            <Fact label={t("balls")} value={sum((entry) => entry.balls).join(":")} />
            {day.position ? (
              <Fact
                label={t("positionAfter")}
                value={`${day.position.after}.`}
                sub={day.position.before !== undefined ? t("positionBefore", { position: day.position.before }) : undefined}
                highlight="accent"
              />
            ) : null}
            {known.length > 0 ? (
              <Fact
                label={t("appearances")}
                value={known.filter((fixture) => fixture.appearance?.status === "played").length}
                sub={t("of", { count: known.length })}
                highlight="win"
              />
            ) : null}
          </dl>
        ) : (
          <dl data-reveal-stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Fact label={t("eyebrow")} value={formatShortDate(datum, locale)} sub={day.time ? t("start", { time: formatTime(day.fixtures[0].date, locale) ?? day.time }) : undefined} />
            <Fact label={t("opponent")} value={day.fixtures.length} sub={day.fixtures.map((fixture) => fixture.opponent).join(", ")} />
            {season.standing ? (
              <Fact label={tSeason("standing")} value={`${season.standing.position}.`} sub={tSeason("of", { teams: season.standing.teams })} highlight="accent" />
            ) : null}
          </dl>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div className="min-w-0 space-y-8">
          {/* Bericht */}
          <section aria-labelledby="bericht" className="card p-6 sm:p-8" data-reveal>
            <h2 id="bericht" className="eyebrow">
              {day.played ? t("report") : t("preview")}
            </h2>
            {custom ? (
              <div className="mt-4">
                <MdxContent source={custom.body} lang={custom.contentLocale !== locale ? custom.contentLocale : undefined} />
              </div>
            ) : (
              <div className="mt-4 max-w-[68ch] space-y-4 text-[16.5px] leading-relaxed text-muted">
                {report.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            )}
            <p className="mt-6 flex items-center gap-2 border-t border-line pt-4 font-mono text-[12px] text-muted">
              {custom ? null : <span aria-hidden="true" className="live-dot" />}
              {custom ? t("ownNote") : t("autoNote")}
            </p>
          </section>

          {/* Spiele */}
          {day.fixtures.map((fixture) => (
            <article
              key={`${fixture.date}-${fixture.number ?? fixture.opponent}`}
              id={fixture.number ? `spiel-${fixture.number}` : undefined}
              aria-labelledby={`titel-${fixture.number ?? fixture.opponent}`}
              className="card scroll-mt-24 overflow-hidden"
              data-reveal
            >
              <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line bg-surface px-5 py-4 sm:px-6">
                <div>
                  <p className="eyebrow">
                    {fixture.number ? t("match", { number: fixture.number }) : t("matchShort")}
                    {formatTime(fixture.date, locale) ? ` · ${formatTime(fixture.date, locale)}` : ""}
                  </p>
                  <h3 id={`titel-${fixture.number ?? fixture.opponent}`} className="mt-1 text-lg leading-snug">
                    <MatchTeams fixture={fixture} />
                  </h3>
                </div>
                {fixture.result && fixture.outcome ? (
                  <p className="flex items-center gap-3">
                    <OutcomeBadge outcome={fixture.outcome} />
                    <span className="text-3xl font-semibold tracking-[-0.02em] tabular-nums">{fixture.result.join(":")}</span>
                  </p>
                ) : (
                  <span className="font-mono text-[12.5px] text-muted">{t("open")}</span>
                )}
              </header>
              {fixture.result ? (
                <PlayedMatch fixture={fixture} season={season} locale={locale} />
              ) : (
                <UpcomingMatch fixture={fixture} season={season} locale={locale} />
              )}
            </article>
          ))}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          {day.venue ? (
            <section aria-labelledby="halle" className="card p-5" data-reveal="right">
              <h2 id="halle" className="eyebrow">
                {t("venue")}
              </h2>
              <address className="mt-3 not-italic">
                <span className="block font-semibold">{day.venue.name}</span>
                {day.venue.street ? <span className="block text-muted">{day.venue.street}</span> : null}
                {day.venue.city ? <span className="block text-muted">{day.venue.city}</span> : null}
              </address>
              {day.venue.lat !== undefined && day.venue.lng !== undefined ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${day.venue.lat}&mlon=${day.venue.lng}#map=16/${day.venue.lat}/${day.venue.lng}`}
                  rel="noopener"
                  className="arrow-link mt-4 text-[15px]"
                  title={t("mapNote")}
                >
                  {t("map")}
                </a>
              ) : null}
            </section>
          ) : null}

          {day.host || day.home ? (
            <section aria-labelledby="ausrichter" className="card p-5" data-reveal="right">
              <h2 id="ausrichter" className="eyebrow">
                {t("host")}
              </h2>
              <p className="mt-3 font-semibold">{day.home ? site.team.name : day.host}</p>
              {day.home ? <p className="text-sm text-muted">{t("homeMatchday")}</p> : null}
            </section>
          ) : null}

          {day.others.length > 0 ? (
            <section aria-labelledby="ausserdem" className="card p-5" data-reveal="right">
              <h2 id="ausserdem" className="eyebrow">
                {t("others")}
              </h2>
              <ul className="mt-3 space-y-3">
                {day.others.map((match) => (
                  <li key={`${match.number}-${match.teams.join()}`} className="text-[15px]">
                    <span className="block">{match.teams.join(" – ")}</span>
                    {match.result ? (
                      <span className="block font-mono text-[13px] text-muted tabular-nums">
                        <span className="font-semibold text-fg">{match.result.join(":")}</span>
                        {match.sets.length > 0 ? ` (${match.sets.join(", ")})` : null}
                      </span>
                    ) : (
                      <span className="block font-mono text-[12.5px] text-muted">{t("open")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <nav aria-label={t("eyebrow")} className="grid grid-cols-2 gap-3" data-reveal="right">
            {day.previous ? (
              <Link
                href={{ pathname: "/saison/[datum]", params: { datum: day.previous } }}
                className="rounded-xl border border-line p-4 transition-colors hover:bg-surface"
              >
                <span className="eyebrow block">{t("previous")}</span>
                <span className="mt-1 block font-medium">{formatShortDate(day.previous, locale)}</span>
              </Link>
            ) : (
              <span />
            )}
            {day.next ? (
              <Link
                href={{ pathname: "/saison/[datum]", params: { datum: day.next } }}
                className="rounded-xl border border-line p-4 text-right transition-colors hover:bg-surface"
              >
                <span className="eyebrow block">{t("next")}</span>
                <span className="mt-1 block font-medium">{formatShortDate(day.next, locale)}</span>
              </Link>
            ) : null}
          </nav>
        </aside>
      </div>
    </div>
  );
}
