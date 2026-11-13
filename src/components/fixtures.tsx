import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import type { Fixture, Outcome, Season, TableRow } from "@/lib/content";
import { Link } from "@/i18n/navigation";
import { formatDate, formatShortDate, formatTime, toIsoBerlin } from "@/lib/format";

import { CheckIcon, ChevronRightIcon } from "./icons";

const OUTCOME_STYLE: Record<Outcome, string> = {
  win: "bg-win-soft text-win",
  loss: "bg-loss-soft text-loss",
};

/** „SSV Bobingen – TSV Pfuhl“ in der offiziellen Reihenfolge */
export function matchTitle(fixture: Fixture): string {
  return fixture.teams.join(" – ");
}

/** Begegnung mit hervorgehobener eigener Mannschaft */
export function MatchTeams({ fixture }: { fixture: Fixture }) {
  return (
    <>
      <span className={fixture.own === 0 ? "font-semibold" : undefined}>{fixture.teams[0]}</span>
      <span className="text-muted"> – </span>
      <span className={fixture.own === 1 ? "font-semibold" : undefined}>{fixture.teams[1]}</span>
    </>
  );
}

/** „Heim“, „Spieltag bei SSV Bobingen“ oder „Auswärts“, dazu Halle und Notiz */
export async function matchPlace(fixture: Fixture): Promise<string> {
  const t = await getTranslations("season");
  const where = fixture.home ? t("home") : fixture.host ? t("hostedBy", { team: fixture.host }) : t("away");
  return [where, fixture.venue, fixture.note].filter(Boolean).join(" · ");
}

/** Sieg/Niederlage als kleine Pille („Sieg“ / „Niederlage“). */
export async function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const t = await getTranslations("season");
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 font-mono text-[11.5px] font-medium ${OUTCOME_STYLE[outcome]}`}>
      {t(outcome)}
    </span>
  );
}

/** Eigener Einsatz laut Spielbericht: grünes Häkchen, „Kader“ oder Strich */
export async function AppearanceMark({ appearance }: { appearance: NonNullable<Fixture["appearance"]> }) {
  const t = await getTranslations("season");
  if (appearance.status === "played") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-medium text-win">
        <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-win-soft">
          <CheckIcon width={11} height={11} strokeWidth={3} />
        </span>
        {appearance.libero ? t("appearanceLibero") : <span className="sr-only">{t("appearancePlayed")}</span>}
      </span>
    );
  }
  if (appearance.status === "squad") {
    return <span className="font-mono text-[11.5px] text-muted">{t("appearanceSquad")}</span>;
  }
  return (
    <span className="font-mono text-[12.5px] text-muted">
      <span aria-hidden="true">–</span>
      <span className="sr-only">{t("appearanceAbsent")}</span>
    </span>
  );
}

/** Satzergebnisse, z. B. „25:21 · 22:25 · 25:19“ */
export async function SetScores({ sets, className = "" }: { sets: string[]; className?: string }) {
  if (sets.length === 0) return null;
  const t = await getTranslations("season");
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      <span className="sr-only">{t("sets")}: </span>
      {sets.join(" · ")}
    </span>
  );
}

export async function FixtureTable({
  fixtures,
  season,
  locale,
}: {
  fixtures: Fixture[];
  season: string;
  locale: Locale;
}) {
  const t = await getTranslations("season");

  if (fixtures.length === 0) return <p className="text-muted">{t("noFixtures")}</p>;

  const showCompetition = fixtures.some((fixture) => fixture.competition);
  const showAppearance = fixtures.some((fixture) => fixture.appearance);
  // Nächster Spieltag: erstes Spiel ohne Ergebnis und alle weiteren am selben Tag
  const nextDay = fixtures.find((fixture) => !fixture.result)?.date.slice(0, 10);
  const places = await Promise.all(fixtures.map(matchPlace));

  return (
    // Fokussierbar, damit sich die Tabelle auf schmalen Bildschirmen auch
    // per Tastatur seitlich scrollen lässt. `relative` hält die absolut
    // positionierten sr-only-Texte im Scrollbereich – sonst verbreitern sie
    // auf dem Handy die ganze Seite.
    <div
      data-reveal
      className="card relative overflow-x-auto"
      role="region"
      aria-label={t("fixturesCaption", { season })}
      tabIndex={0}
    >
      <table className="w-full min-w-[40rem] border-collapse text-left text-[15px]">
        <caption className="sr-only">{t("fixturesCaption", { season })}</caption>
        <thead className="border-b border-line bg-surface">
          <tr>
            <th scope="col" className="eyebrow table-cell px-5 py-3 font-normal">{t("date")}</th>
            <th scope="col" className="eyebrow table-cell px-5 py-3 font-normal">{t("match")}</th>
            {showCompetition ? <th scope="col" className="eyebrow table-cell px-5 py-3 font-normal">{t("competition")}</th> : null}
            {showAppearance ? <th scope="col" className="eyebrow table-cell px-3 py-3 text-center font-normal">{t("appearanceColumn")}</th> : null}
            <th scope="col" className="eyebrow table-cell px-5 py-3 text-right font-normal">{t("result")}</th>
          </tr>
        </thead>
        <tbody>
          {fixtures.map((fixture, index) => {
            const time = formatTime(fixture.date, locale);
            // Zweites Spiel desselben Spieltags: Datum nicht noch einmal sichtbar wiederholen
            const sameDayAsPrevious = index > 0 && fixtures[index - 1].date.slice(0, 10) === fixture.date.slice(0, 10);
            const upNext = !fixture.result && fixture.date.startsWith(nextDay ?? "-");
            return (
              <tr
                key={`${fixture.date}-${fixture.number ?? ""}-${fixture.opponent}`}
                className={`align-top ${sameDayAsPrevious ? "" : "border-t border-line first:border-t-0"} ${upNext ? "bg-accent-soft/60" : ""}`}
              >
                <td className={`px-5 whitespace-nowrap ${sameDayAsPrevious ? "pt-1 pb-4" : "py-4"}`}>
                  <time dateTime={toIsoBerlin(fixture.date)}>
                    <span className="sr-only">{formatDate(fixture.date, locale, { weekday: true })}</span>
                    {sameDayAsPrevious ? null : (
                      <span aria-hidden="true" className="font-medium">
                        {formatShortDate(fixture.date, locale)}
                        {time ? <span className="block font-mono text-[12.5px] font-normal text-muted">{time}</span> : null}
                      </span>
                    )}
                  </time>
                </td>
                <th scope="row" className={`px-5 font-normal ${sameDayAsPrevious ? "pt-1 pb-4" : "py-4"}`}>
                  {/* Ganze Begegnung ist der Link zum Spieltag (Statistik, Bericht) */}
                  <Link
                    href={{ pathname: "/saison/[datum]", params: { datum: fixture.date.slice(0, 10) }, hash: fixture.number ? `spiel-${fixture.number}` : undefined }}
                    className="group/match -mx-2 -my-1 flex items-start justify-between gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-surface"
                  >
                    <span>
                      <span className="underline-offset-4 group-hover/match:underline">
                        <MatchTeams fixture={fixture} />
                      </span>
                      <span className="block text-sm text-muted">{places[index]}</span>
                    </span>
                    <ChevronRightIcon
                      width={16}
                      height={16}
                      aria-hidden="true"
                      className="mt-1 shrink-0 text-muted transition-transform group-hover/match:translate-x-0.5"
                    />
                  </Link>
                </th>
                {showCompetition ? (
                  <td className={`px-5 text-muted ${sameDayAsPrevious ? "pt-1 pb-4" : "py-4"}`}>{fixture.competition ?? "–"}</td>
                ) : null}
                {showAppearance ? (
                  <td className={`px-3 text-center ${sameDayAsPrevious ? "pt-1 pb-4" : "py-4"}`}>
                    {fixture.appearance ? <AppearanceMark appearance={fixture.appearance} /> : null}
                  </td>
                ) : null}
                <td className={`px-5 text-right whitespace-nowrap ${sameDayAsPrevious ? "pt-1 pb-4" : "py-4"}`}>
                  {fixture.result && fixture.outcome ? (
                    <>
                      <span className="inline-flex items-center gap-2.5">
                        <OutcomeBadge outcome={fixture.outcome} />
                        <span className="text-lg font-semibold tracking-tight tabular-nums">{fixture.result.join(":")}</span>
                      </span>
                      <SetScores sets={fixture.sets} className="mt-0.5 block text-[12px] text-muted" />
                    </>
                  ) : upNext ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-2.5 py-1 font-mono text-[11.5px] font-medium">
                      <span aria-hidden="true" className="live-dot" />
                      {t("nextUp")}
                    </span>
                  ) : (
                    <span className="font-mono text-[12.5px] text-muted">{t("open")}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export async function LeagueTable({ rows, league }: { rows: TableRow[]; league: string }) {
  const t = await getTranslations("season");
  const numeric = "px-3 py-3 text-right tabular-nums sm:px-4";

  return (
    <div data-reveal className="card relative overflow-x-auto" role="region" aria-label={t("tableCaption", { league })} tabIndex={0}>
      <table className="w-full min-w-[36rem] border-collapse text-left text-[15px]">
        <caption className="sr-only">{t("tableCaption", { league })}</caption>
        <thead className="border-b border-line bg-surface">
          <tr>
            <th scope="col" className="eyebrow table-cell py-3 pr-2 pl-5 font-normal">
              <abbr title={t("position")} className="no-underline">#</abbr>
            </th>
            <th scope="col" className="eyebrow table-cell px-3 py-3 font-normal">{t("team")}</th>
            <th scope="col" className={`eyebrow table-cell font-normal ${numeric}`}>{t("played")}</th>
            <th scope="col" className={`eyebrow table-cell font-normal ${numeric}`}>{t("won")}</th>
            <th scope="col" className={`eyebrow table-cell font-normal ${numeric}`}>{t("lost")}</th>
            <th scope="col" className={`eyebrow table-cell font-normal ${numeric}`}>{t("setsShort")}</th>
            <th scope="col" className={`eyebrow table-cell font-normal ${numeric}`}>{t("balls")}</th>
            <th scope="col" className={`eyebrow table-cell py-3 pr-5 pl-3 text-right font-normal`}>{t("pointsShort")}</th>
          </tr>
        </thead>
        <tbody data-reveal-stagger>
          {rows.map((row) => (
            <tr key={row.team} className={`border-b border-line last:border-0 ${row.own ? "bg-accent-soft font-semibold" : ""}`}>
              <td className="py-3 pr-2 pl-5 tabular-nums">{row.position}.</td>
              <th scope="row" className={`px-3 py-3 ${row.own ? "font-semibold" : "font-normal"}`}>{row.team}</th>
              <td className={numeric}>{row.played}</td>
              <td className={numeric}>{row.won}</td>
              <td className={numeric}>{row.lost}</td>
              <td className={`${numeric} font-mono text-[13.5px]`}>{row.sets}</td>
              <td className={`${numeric} font-mono text-[13.5px]`}>{row.balls}</td>
              <td className={`py-3 pr-5 pl-3 text-right tabular-nums ${row.own ? "text-accent" : ""}`}>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** „Quelle: Bayerischer Volleyball-Verband · Stand …“ bzw. Hinweis bei Ausfall */
export async function SourceNote({ source, locale }: { source: NonNullable<Season["source"]>; locale: Locale }) {
  const t = await getTranslations("season");
  const updated = source.updatedAt
    ? new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
        timeZone: "Europe/Berlin",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(source.updatedAt))
    : undefined;

  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted" data-bvv-error={source.error}>
      {updated ? <span aria-hidden="true" className="live-dot" /> : null}
      <span>{updated ? t("source", { updated }) : t("unavailable")}</span>
      <a href={source.url} rel="noopener" className="font-medium text-accent underline-offset-4 hover:underline">
        {t("sourceLink")}
      </a>
    </p>
  );
}
