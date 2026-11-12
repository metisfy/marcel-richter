import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import type { Fixture, Outcome } from "@/lib/content";
import { formatDate, formatShortDate, formatTime, toIsoBerlin } from "@/lib/format";

const OUTCOME_STYLE: Record<Outcome, string> = {
  win: "text-win",
  draw: "text-draw",
  loss: "text-loss",
};

const OUTCOME_LETTER: Record<Locale, Record<Outcome, string>> = {
  de: { win: "S", draw: "U", loss: "N" },
  en: { win: "W", draw: "D", loss: "L" },
};

export function matchTitle(fixture: Fixture, teamName: string): [string, string] {
  return fixture.home ? [teamName, fixture.opponent] : [fixture.opponent, teamName];
}

export async function OutcomeBadge({ outcome, locale }: { outcome: Outcome; locale: Locale }) {
  const t = await getTranslations("season");
  return (
    <span
      className={`inline-grid size-6 place-items-center rounded-full border border-current text-xs font-bold ${OUTCOME_STYLE[outcome]}`}
      title={t(outcome)}
    >
      <span aria-hidden="true">{OUTCOME_LETTER[locale][outcome]}</span>
      <span className="sr-only">{t(outcome)}</span>
    </span>
  );
}

export async function FixtureTable({
  fixtures,
  season,
  teamName,
  locale,
}: {
  fixtures: Fixture[];
  season: string;
  teamName: string;
  locale: Locale;
}) {
  const t = await getTranslations("season");

  if (fixtures.length === 0) return <p className="text-muted">{t("noFixtures")}</p>;

  return (
    // Fokussierbar, damit sich die Tabelle auf schmalen Bildschirmen auch
    // per Tastatur seitlich scrollen lässt. `relative` hält die absolut
    // positionierten sr-only-Texte im Scrollbereich – sonst verbreitern sie
    // auf dem Handy die ganze Seite.
    <div
      className="card relative overflow-x-auto"
      role="region"
      aria-label={t("fixturesCaption", { season })}
      tabIndex={0}
    >
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <caption className="sr-only">{t("fixturesCaption", { season })}</caption>
        <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">{t("date")}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{t("match")}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{t("competition")}</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">{t("result")}</th>
          </tr>
        </thead>
        <tbody>
          {fixtures.map((fixture) => {
            const [home, away] = matchTitle(fixture, teamName);
            const time = formatTime(fixture.date, locale);
            return (
              <tr key={`${fixture.date}-${fixture.opponent}`} className="border-b border-border last:border-0">
                <td className="px-4 py-3 whitespace-nowrap">
                  <time dateTime={toIsoBerlin(fixture.date)}>
                    <span className="sr-only">{formatDate(fixture.date, locale, { weekday: true })}</span>
                    <span aria-hidden="true">
                      {formatShortDate(fixture.date, locale)}
                      {time ? <span className="text-muted"> · {time}</span> : null}
                    </span>
                  </time>
                </td>
                <th scope="row" className="px-4 py-3 font-medium">
                  <span className={fixture.home ? "font-semibold" : undefined}>{home}</span>
                  <span className="text-muted"> – </span>
                  <span className={!fixture.home ? "font-semibold" : undefined}>{away}</span>
                  <span className="ml-2 text-xs font-normal text-muted">
                    ({fixture.home ? t("home") : t("away")})
                  </span>
                  {fixture.note ? <span className="block text-xs font-normal text-muted">{fixture.note}</span> : null}
                </th>
                <td className="px-4 py-3 text-muted">{fixture.competition ?? "–"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {fixture.result && fixture.outcome ? (
                    <span className="inline-flex items-center gap-2 font-semibold tabular-nums">
                      {fixture.result.home}:{fixture.result.away}
                      <OutcomeBadge outcome={fixture.outcome} locale={locale} />
                    </span>
                  ) : (
                    <span className="text-muted">{t("open")}</span>
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
