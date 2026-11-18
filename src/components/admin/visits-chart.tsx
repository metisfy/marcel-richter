"use client";

import { useState } from "react";

/*
 * Seitenaufrufe je Tag als Säulen (eine Reihe → keine Legende, der Titel
 * benennt sie). Säulen höchstens 24 px breit, oben 4 px gerundet, 2 px Luft
 * dazwischen, eine Grundlinie, dünne Hilfslinien. Beim Überfahren oder per
 * Tastatur: Datum, Aufrufe (hervorgehoben) und Besucher. Alle Werte stehen
 * zusätzlich in der Tabellenansicht darunter.
 */

type Day = { day: string; views: number; visitors: number };

const shortDate = (day: string) =>
  new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
const longDate = (day: string) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "long", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

export function VisitsChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...days.map((day) => day.views), 0));
  const ticks = [max, max / 2, 0];
  const current = active !== null ? days[active] : null;
  const labelEvery = Math.ceil(days.length / 7);

  return (
    <div>
      <div className="relative grid grid-cols-[auto_1fr] gap-x-3">
        {/* Y-Achse */}
        <div className="relative h-48 font-mono text-[11px] text-muted tabular-nums">
          {ticks.map((tick, index) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}>
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </span>
          ))}
        </div>

        {/* Fläche mit Hilfslinien und Säulen */}
        <div className="relative h-48" onMouseLeave={() => setActive(null)}>
          {ticks.map((tick, index) => (
            <div
              key={tick}
              aria-hidden="true"
              className={`absolute inset-x-0 h-px ${index === ticks.length - 1 ? "bg-muted/40" : "bg-line"}`}
              style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {days.map((day, index) => (
              <button
                key={day.day}
                type="button"
                aria-label={`${longDate(day.day)}: ${day.views} Aufrufe, ${day.visitors} Besucher`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="group flex h-full min-w-0 flex-1 cursor-default items-end justify-center focus:outline-none"
              >
                <span
                  className={`block w-full max-w-6 rounded-t-[4px] bg-chart transition-opacity ${
                    active === null || active === index ? "opacity-100" : "opacity-45"
                  } group-focus-visible:ring-2 group-focus-visible:ring-accent-bright group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg`}
                  style={{ height: day.views ? `max(${(day.views / max) * 100}%, 2px)` : "0px" }}
                />
              </button>
            ))}
          </div>

          {current && active !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-bg px-3 py-2 text-sm shadow-soft"
              style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
            >
              <p className="text-xs text-muted">{longDate(current.day)}</p>
              <p className="mt-0.5 flex items-center gap-2">
                <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-chart" />
                <strong className="tabular-nums">{current.views}</strong> <span className="text-muted">Aufrufe</span>
              </p>
              <p className="text-muted tabular-nums">{current.visitors} Besucher</p>
            </div>
          ) : null}
        </div>

        {/* X-Achse */}
        <div />
        <div className="mt-2 flex gap-[2px] font-mono text-[11px] text-muted">
          {days.map((day, index) => (
            <span key={day.day} className="min-w-0 flex-1 text-center whitespace-nowrap">
              {index % labelEvery === 0 || index === days.length - 1 ? shortDate(day.day) : ""}
            </span>
          ))}
        </div>
      </div>

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer text-muted hover:text-fg">Als Tabelle anzeigen</summary>
        <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Tag</th>
                <th className="px-3 py-2 text-right font-medium">Aufrufe</th>
                <th className="px-3 py-2 text-right font-medium">Besucher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...days].reverse().map((day) => (
                <tr key={day.day}>
                  <td className="px-3 py-1.5">{longDate(day.day)}</td>
                  <td className="px-3 py-1.5 text-right">{day.views}</td>
                  <td className="px-3 py-1.5 text-right">{day.visitors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
