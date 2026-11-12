import { getTranslations } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import type { Fixture, Outcome } from "@/lib/content";
import { formatDate, formatShortDate, formatTime, toIsoBerlin } from "@/lib/format";

const OUTCOME_STYLE: Record<Outcome, string> = {
  win: "bg-win-soft text-win",
  loss: "bg-loss-soft text-loss",
};

export function matchTitle(fixture: Fixture, teamName: string): [string, string] {
  return fixture.home ? [teamName, fixture.opponent] : [fixture.opponent, teamName];
}

/** Sieg/Niederlage als kleine Pille („Sieg“ / „Niederlage“). */
export async function OutcomeBadge({ outcome }: { outcome: Outcome; locale?: Locale }) {
  const t = await getTranslations("season");
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 font-mono text-[11.5px] font-medium ${OUTCOME_STYLE[outcome]}`}>
      {t(outcome)}
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
      <table className="w-full min-w-[40rem] border-collapse text-left text-[15px]">
        <caption className="sr-only">{t("fixturesCaption", { season })}</caption>
        <thead className="border-b border-line bg-surface">
          <tr>
            <th scope="col" className="eyebrow table-cell px-5 py-3 font-normal">{t("date")}</th>
            <th scope="col" className="eyebrow table-cell px-5 py-3 font-normal">{t("match")}</th>
            <th scope="col" className="eyebrow table-cell px-5 py-3 font-normal">{t("competition")}</th>
            <th scope="col" className="eyebrow table-cell px-5 py-3 text-right font-normal">{t("result")}</th>
          </tr>
        </thead>
        <tbody>
          {fixtures.map((fixture) => {
            const [home, away] = matchTitle(fixture, teamName);
            const time = formatTime(fixture.date, locale);
            return (
              <tr key={`${fixture.date}-${fixture.opponent}`} className="border-b border-line align-top last:border-0">
                <td className="px-5 py-4 whitespace-nowrap">
                  <time dateTime={toIsoBerlin(fixture.date)}>
                    <span className="sr-only">{formatDate(fixture.date, locale, { weekday: true })}</span>
                    <span aria-hidden="true" className="font-medium">
                      {formatShortDate(fixture.date, locale)}
                      {time ? <span className="block font-mono text-[12.5px] font-normal text-muted">{time}</span> : null}
                    </span>
                  </time>
                </td>
                <th scope="row" className="px-5 py-4 font-normal">
                  <span className={fixture.home ? "font-semibold" : undefined}>{home}</span>
                  <span className="text-muted"> – </span>
                  <span className={!fixture.home ? "font-semibold" : undefined}>{away}</span>
                  <span className="block text-sm text-muted">
                    {fixture.home ? t("home") : t("away")}
                    {fixture.venue ? ` · ${fixture.venue}` : null}
                    {fixture.note ? ` · ${fixture.note}` : null}
                  </span>
                </th>
                <td className="px-5 py-4 text-muted">{fixture.competition ?? "–"}</td>
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  {fixture.result && fixture.outcome ? (
                    <>
                      <span className="inline-flex items-center gap-2.5">
                        <OutcomeBadge outcome={fixture.outcome} />
                        <span className="text-lg font-semibold tracking-tight tabular-nums">
                          {fixture.result.home}:{fixture.result.away}
                        </span>
                      </span>
                      <SetScores sets={fixture.sets} className="mt-0.5 block text-[12px] text-muted" />
                    </>
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
