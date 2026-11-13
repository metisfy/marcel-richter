import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import type { Locale } from "@/i18n/routing";
import type { Fixture } from "@/lib/content";
import { formatShortDate } from "@/lib/format";
import type { FormEntry, MatchStats } from "@/lib/matchday";

/**
 * Sätze als Balkenpaare (eigene Punkte blau, Gegner grau). Die Balken wachsen
 * beim Hineinscrollen nacheinander aus der Grundlinie (data-reveal="bars").
 */
export async function SetBars({ stats, own, opponent }: { stats: MatchStats; own: string; opponent: string }) {
  const t = await getTranslations("matchday");
  const max = Math.max(25, ...stats.sets.flat());
  return (
    <figure data-reveal="bars">
      <figcaption className="sr-only">
        {stats.sets.map(([a, b], index) => `${t("set")} ${index + 1}: ${own} ${a}, ${opponent} ${b}`).join("; ")}
      </figcaption>
      <div aria-hidden="true" className="flex h-36 items-end gap-3 sm:gap-6">
        {stats.sets.map(([a, b], index) => (
          <div key={index} className="flex h-full flex-1 flex-col justify-end">
            <div className="flex flex-1 items-end justify-center gap-1.5">
              <span
                className={`bar w-full max-w-7 rounded-t-[5px] ${a > b ? "bg-accent-bright" : "bg-accent-bright/35"}`}
                style={{ height: `${(a / max) * 100}%`, "--delay": `${index * 0.1}s` } as CSSProperties}
              />
              <span
                className="bar w-full max-w-7 rounded-t-[5px] bg-surface-2"
                style={{ height: `${(b / max) * 100}%`, "--delay": `${index * 0.1 + 0.05}s` } as CSSProperties}
              />
            </div>
            <span className="mt-2 text-center font-mono text-[11.5px] text-muted tabular-nums">
              {a}:{b}
            </span>
            <span className="text-center font-mono text-[10.5px] tracking-[0.12em] text-muted/80 uppercase">
              {t("set")} {index + 1}
            </span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Spielwertung wie beim Verband: Mannschaft | Sätze | 1 … 5 | Bälle */
export async function SetTable({ fixture, balls }: { fixture: Fixture; balls?: [number, number] }) {
  const t = await getTranslations("matchday");
  if (!fixture.result) return null;
  const rows = fixture.teams.map((team, index) => ({
    team,
    own: fixture.own === index,
    sets: fixture.result![index],
    points: fixture.sets.map((set) => Number(set.split(":")[index])),
    balls: balls?.[index],
  }));
  return (
    <div className="relative overflow-x-auto rounded-xl border border-line" role="region" aria-label={t("setsCaption", { teams: fixture.teams.join(" – ") })} tabIndex={0}>
      <table className="w-full min-w-[30rem] border-collapse text-left text-[14.5px]">
        <caption className="sr-only">{t("setsCaption", { teams: fixture.teams.join(" – ") })}</caption>
        <thead className="border-b border-line bg-surface">
          <tr>
            <th scope="col" className="eyebrow table-cell px-4 py-2.5 font-normal">
              <span className="sr-only">{t("opponent")}</span>
            </th>
            <th scope="col" className="eyebrow table-cell px-3 py-2.5 text-center font-normal">{t("sets")}</th>
            {fixture.sets.map((_, index) => (
              <th key={index} scope="col" className="eyebrow table-cell px-2 py-2.5 text-center font-normal">
                {index + 1}
              </th>
            ))}
            <th scope="col" className="eyebrow table-cell px-4 py-2.5 text-right font-normal">{t("total")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.team} className={`border-b border-line last:border-0 ${row.own ? "bg-accent-soft/60" : ""}`}>
              <th scope="row" className={`px-4 py-2.5 ${row.own ? "font-semibold" : "font-normal"}`}>{row.team}</th>
              <td className="px-3 py-2.5 text-center text-base font-semibold tabular-nums">{row.sets}</td>
              {row.points.map((points, index) => {
                const other = rows.find((entry) => entry !== row)!.points[index];
                return (
                  <td key={index} className={`px-2 py-2.5 text-center font-mono tabular-nums ${points > other ? "font-semibold" : "text-muted"}`}>
                    {points}
                  </td>
                );
              })}
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.balls ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Letzte Ergebnisse als Kürzel (S/N) mit Gegner und Ergebnis im Tooltip */
export async function FormChips({ form, locale }: { form: FormEntry[]; locale: Locale }) {
  const t = await getTranslations("matchday");
  if (form.length === 0) return <span className="text-muted">–</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {form.map((entry) => {
        const label = `${formatShortDate(entry.date, locale)}: ${entry.outcome === "win" ? t("formWinLong") : t("formLossLong")} ${entry.score.join(":")} – ${entry.opponent}`;
        return (
          <li key={`${entry.date}-${entry.opponent}`}>
            <span
              title={label}
              className={`inline-grid size-7 place-items-center rounded-lg font-mono text-[12px] font-semibold ${
                entry.outcome === "win" ? "bg-win-soft text-win" : "bg-loss-soft text-loss"
              }`}
            >
              <span aria-hidden="true">{entry.outcome === "win" ? t("formWin") : t("formLoss")}</span>
              <span className="sr-only">{label}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Tabellenplatz nach jedem Spieltag als Linie (Platz 1 oben). Linie und
 * Hilfslinien als SVG (verzerrt mit, Strichstärke bleibt), Punkte und
 * Beschriftungen als HTML – so bleibt die Schrift auf jedem Bildschirm gleich groß.
 */
export async function RankingChart({
  ranking,
  teams,
  locale,
}: {
  ranking: { date: string; position: number }[];
  teams: number;
  locale: Locale;
}) {
  const t = await getTranslations("matchday");
  if (ranking.length === 0) return null;
  // Koordinaten in Prozent der Zeichenfläche
  const x = (index: number) => (ranking.length > 1 ? 6 + (index / (ranking.length - 1)) * 88 : 50);
  const y = (position: number) => 14 + ((position - 1) / Math.max(1, teams - 1)) * 72;
  const label = `${t("rankingCaption")}: ${ranking
    .map((entry) => t("rankingPoint", { date: formatShortDate(entry.date, locale), position: entry.position }))
    .join(", ")}`;

  return (
    <figure className="card p-5 sm:p-6" data-reveal>
      <figcaption className="eyebrow">{t("ranking")}</figcaption>
      <div role="img" aria-label={label} className="relative mt-4 h-48">
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          {[1, teams].map((position) => (
            <line
              key={position}
              x1={3}
              x2={97}
              y1={y(position)}
              y2={y(position)}
              className="stroke-line"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points={ranking.map((entry, index) => `${x(index)},${y(entry.position)}`).join(" ")}
            fill="none"
            className="stroke-accent-bright"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {[1, teams].map((position) => (
          <span
            key={position}
            aria-hidden="true"
            className="absolute left-0 -translate-y-1/2 font-mono text-[11px] text-muted"
            style={{ top: `${y(position)}%` }}
          >
            {position}.
          </span>
        ))}
        {ranking.map((entry, index) => (
          <span key={entry.date} aria-hidden="true" className="absolute" style={{ left: `${x(index)}%`, top: `${y(entry.position)}%` }}>
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[13px] font-semibold">{entry.position}.</span>
            <span className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-accent-bright bg-bg" />
          </span>
        ))}
        {ranking.map((entry, index) => (
          <span
            key={`${entry.date}-label`}
            aria-hidden="true"
            className="absolute bottom-0 -translate-x-1/2 font-mono text-[11px] whitespace-nowrap text-muted"
            style={{ left: `${x(index)}%` }}
          >
            {formatShortDate(entry.date, locale)}
          </span>
        ))}
      </div>
    </figure>
  );
}
