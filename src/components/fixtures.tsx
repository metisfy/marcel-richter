import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import type { Fixture, Outcome } from "@/lib/content";
import { formatDate, formatShortDate, formatTime, toIsoBerlin } from "@/lib/format";

const OUTCOME_STYLE: Record<Outcome, string> = {
  win: "bg-win",
  loss: "bg-loss",
};

const OUTCOME_LETTER: Record<Locale, Record<Outcome, string>> = {
  de: { win: "S", loss: "N" },
  en: { win: "W", loss: "L" },
};

export function matchTitle(fixture: Fixture, teamName: string): [string, string] {
  return fixture.home ? [teamName, fixture.opponent] : [fixture.opponent, teamName];
}

/** Sieg/Niederlage als kleines Quadrat mit Buchstabe (S/N bzw. W/L). */
export async function OutcomeBadge({ outcome, locale }: { outcome: Outcome; locale: Locale }) {
  const t = await getTranslations("season");
  return (
    <span
      className={`inline-grid size-6 shrink-0 place-items-center text-xs font-bold text-bg ${OUTCOME_STYLE[outcome]}`}
      title={t(outcome)}
    >
      <span aria-hidden="true">{OUTCOME_LETTER[locale][outcome]}</span>
      <span className="sr-only">{t(outcome)}</span>
    </span>
  );
}

/** Satzergebnisse, z. B. „25:21 · 22:25 · 25:19“ */
export async function SetScores({ sets, className = "" }: { sets: string[]; className?: string }) {
  if (sets.length === 0) return null;
  const t = await getTranslations("season");
  return (
    <span className={`tabular-nums ${className}`}>
      <span className="sr-only">{t("sets")}: </span>
      {sets.join(" · ")}
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
      className="relative overflow-x-auto"
      role="region"
      aria-label={t("fixturesCaption", { season })}
      tabIndex={0}
    >
      <table className="w-full min-w-[40rem] border-collapse text-left text-[0.9375rem]">
        <caption className="sr-only">{t("fixturesCaption", { season })}</caption>
        <thead className="border-b-2 border-rule text-muted">
          <tr>
            <th scope="col" className="label py-2.5 pr-4">{t("date")}</th>
            <th scope="col" className="label py-2.5 pr-4">{t("match")}</th>
            <th scope="col" className="label py-2.5 pr-4">{t("competition")}</th>
            <th scope="col" className="label py-2.5 text-right">{t("result")}</th>
          </tr>
        </thead>
        <tbody>
          {fixtures.map((fixture) => {
            const [home, away] = matchTitle(fixture, teamName);
            const time = formatTime(fixture.date, locale);
            return (
              <tr key={`${fixture.date}-${fixture.opponent}`} className="border-b border-border align-top">
                <td className="py-3.5 pr-4 whitespace-nowrap tabular-nums">
                  <time dateTime={toIsoBerlin(fixture.date)}>
                    <span className="sr-only">{formatDate(fixture.date, locale, { weekday: true })}</span>
                    <span aria-hidden="true">
                      {formatShortDate(fixture.date, locale)}
                      {time ? <span className="block text-sm text-muted">{time}</span> : null}
                    </span>
                  </time>
                </td>
                <th scope="row" className="py-3.5 pr-4 font-normal">
                  <span className={fixture.home ? "font-bold" : undefined}>{home}</span>
                  <span className="text-muted"> – </span>
                  <span className={!fixture.home ? "font-bold" : undefined}>{away}</span>
                  <span className="block text-sm text-muted">
                    {fixture.home ? t("home") : t("away")}
                    {fixture.venue ? ` · ${fixture.venue}` : null}
                    {fixture.note ? ` · ${fixture.note}` : null}
                  </span>
                </th>
                <td className="py-3.5 pr-4 text-muted">{fixture.competition ?? "–"}</td>
                <td className="py-3.5 text-right whitespace-nowrap">
                  {fixture.result && fixture.outcome ? (
                    <>
                      <span className="inline-flex items-center gap-2.5">
                        <span className="display text-2xl tabular-nums">
                          {fixture.result.home}:{fixture.result.away}
                        </span>
                        <OutcomeBadge outcome={fixture.outcome} locale={locale} />
                      </span>
                      <SetScores sets={fixture.sets} className="block text-xs text-muted" />
                    </>
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
