"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useId, useState, useSyncExternalStore } from "react";

import type { LiveEvent, LiveMatch, LivePlayer } from "@/lib/live";

/*
 * Live-Ticker im Browser. Alle Bausteine einer Seite teilen sich eine Abfrage
 * pro Spieltag (/api/live/<datum>, alle 10 Sekunden, pausiert im
 * Hintergrund-Tab). Abgefragt wird nur am Spieltag selbst.
 */

const POLL_MS = 10_000;

type Data = { matches: LiveMatch[]; updatedAt?: number };
type Entry = {
  data?: Data;
  listeners: Set<() => void>;
  timer?: ReturnType<typeof setTimeout>;
  finishedPolls: number;
  /** Kennung der laufenden Abfrageschleife – ältere Schleifen beenden sich */
  run: number;
};
const store = new Map<string, Entry>();

const todayInBerlin = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());

async function poll(datum: string, run: number) {
  const entry = store.get(datum);
  if (!entry || entry.listeners.size === 0 || entry.run !== run) return;
  if (document.visibilityState === "visible") {
    try {
      const response = await fetch(`/api/live/${datum}`, { cache: "no-store" });
      if (response.ok) {
        entry.data = (await response.json()) as Data;
        entry.listeners.forEach((listener) => listener());
      }
    } catch {
      // Netzwerk weg – beim nächsten Mal wieder
    }
  }
  if (entry.run !== run || entry.listeners.size === 0) return;
  // Wenn alles vorbei ist, seltener nachsehen (Endstand steht fest)
  const done = entry.data?.matches.length && entry.data.matches.every((match) => match.status === "post");
  entry.finishedPolls = done ? entry.finishedPolls + 1 : 0;
  entry.timer = setTimeout(() => poll(datum, run), entry.finishedPolls > 2 ? POLL_MS * 6 : POLL_MS);
}

function subscribe(datum: string, listener: () => void) {
  let entry = store.get(datum);
  if (!entry) {
    entry = { listeners: new Set(), finishedPolls: 0, run: 0 };
    store.set(datum, entry);
  }
  entry.listeners.add(listener);
  if (entry.listeners.size === 1) {
    entry.run += 1;
    void poll(datum, entry.run);
  }
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      clearTimeout(entry.timer);
      entry.timer = undefined;
      entry.run += 1; // laufende Schleife beenden
    }
  };
}

const noop = () => () => {};
const nothing = () => undefined;

/** Ist <datum> heute (deutsche Zeit)? Auf dem Server immer nein. */
export function useIsToday(datum: string) {
  return useSyncExternalStore(noop, () => todayInBerlin() === datum, () => false);
}

/** Live-Daten eines Spieltags – nur am Spieltag selbst, sonst undefined. */
export function useLiveMatchday(datum: string): Data | undefined {
  const isToday = useIsToday(datum);
  // Stabile Funktionen: sonst würde React bei jedem Rendern neu abonnieren
  const subscribeToDay = useCallback((listener: () => void) => (isToday ? subscribe(datum, listener) : () => {}), [datum, isToday]);
  const read = useCallback(() => (isToday ? store.get(datum)?.data : undefined), [datum, isToday]);
  return useSyncExternalStore(subscribeToDay, read, nothing);
}

const sameTeams = (match: LiveMatch, teams: [string, string]) => match.teams[0] === teams[0] && match.teams[1] === teams[1];

/** Pulsierendes „LIVE“ */
export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`live-badge ${className}`}>
      <span aria-hidden="true" className="live-badge-dot" />
      LIVE
    </span>
  );
}

/**
 * Für Spielplan und Startseite: läuft das Spiel, „LIVE 1:0 · 18:15“, nach dem
 * Spiel der Endstand vom Ticker; sonst das, was ohnehin dort stand.
 */
export function LiveFixtureStatus({ datum, teams, children }: { datum: string; teams: [string, string]; children?: ReactNode }) {
  const t = useTranslations("live");
  const data = useLiveMatchday(datum);
  const match = data?.matches.find((entry) => sameTeams(entry, teams));
  if (!match || match.status === "pre") return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap" aria-live="polite">
      {match.status === "live" ? <LiveBadge /> : <span className="font-mono text-[11.5px] text-muted">{t("final")}</span>}
      <span className="text-lg font-semibold tabular-nums">{match.sets.join(":")}</span>
      {match.current ? <span className="font-mono text-[12.5px] text-muted tabular-nums">{match.current.score.join(":")}</span> : null}
    </span>
  );
}

const subscribeClock = (listener: () => void) => {
  const timer = setInterval(listener, 60_000);
  return () => clearInterval(timer);
};

/** Heutiges Datum (deutsche Zeit), auf dem Server leer */
function useToday() {
  return useSyncExternalStore(subscribeClock, todayInBerlin, () => "");
}

const subscribeTick = (listener: () => void) => {
  const timer = setInterval(listener, 30_000);
  return () => clearInterval(timer);
};
const nowRounded = () => Math.floor(Date.now() / 30_000) * 30_000;

/** Aktuelle Zeit, alle 30 Sekunden neu; auf dem Server 0 */
function useNow() {
  return useSyncExternalStore(subscribeTick, nowRounded, () => 0);
}

/**
 * Live-Panel für „heute“ – unabhängig von den Saisondaten des BVV, damit der
 * Live-Stand auch dann erscheint, wenn der Ergebnisdienst des Verbands gerade
 * nicht antwortet (z. B. samstags unter Last). Für die Saisonseite.
 */
export function LiveTodayPanel({ ownTeam, hrefPattern }: { ownTeam: string; hrefPattern?: string }) {
  const today = useToday();
  return today ? <LiveMatchdayPanel datum={today} ownTeam={ownTeam} href={hrefPattern?.replace("DATUM", today)} /> : null;
}

/**
 * Schmale, pulsierende Live-Leiste für die Startseite:
 * „LIVE · SSV Bobingen – TSV Pfuhl 1:0 (18:15) · Live verfolgen →“
 * `hrefPattern` ist die Adresse der Spieltagsseite mit „DATUM“ als Platzhalter.
 */
export function LiveTodayStrip({ ownTeam, hrefPattern }: { ownTeam: string; hrefPattern: string }) {
  const t = useTranslations("live");
  const today = useToday();
  const data = useLiveMatchday(today || "-");
  const matches = data?.matches ?? [];
  const live = matches.filter((match) => match.status === "live");
  const upcoming = matches.filter((match) => match.status === "pre");
  if (!today || matches.length === 0) return null;
  // Während des Spiels die laufenden Spiele, davor die anstehenden, danach die Endstände
  const shown = live.length > 0 ? live : upcoming.length > 0 ? upcoming : matches;
  const mode = live.length > 0 ? "live" : upcoming.length > 0 ? "pre" : "post";
  return (
    <a
      href={hrefPattern.replace("DATUM", today)}
      className={`live-strip group mx-auto mt-8 flex w-fit max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border px-4 py-2 text-[14.5px] ${mode === "live" ? "is-live" : ""}`}
      aria-live="polite"
    >
      {mode === "live" ? <LiveBadge /> : <span className="live-badge is-today">{mode === "pre" ? t("today") : t("final")}</span>}
      {shown.map((match) => (
        <span key={match.teams.join("-")} className="whitespace-nowrap">
          <span className={match.teams[0] === ownTeam ? "font-semibold" : ""}>{match.teams[0]}</span>
          <span className="text-muted"> – </span>
          <span className={match.teams[1] === ownTeam ? "font-semibold" : ""}>{match.teams[1]}</span>{" "}
          {match.status === "pre" ? (
            <span className="font-mono text-[12.5px] text-muted tabular-nums">{t("startsAtShort", { time: clock(match.start) })}</span>
          ) : (
            <span className="font-semibold tabular-nums">{match.sets.join(":")}</span>
          )}
          {match.current ? <span className="ml-1 font-mono text-[12.5px] text-muted tabular-nums">({match.current.score.join(":")})</span> : null}
        </span>
      ))}
      <span className="font-medium text-accent transition-transform group-hover:translate-x-0.5">{mode === "post" ? t("toMatchday") : t("follow")} →</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Live-Panel auf der Spieltagsseite
// ---------------------------------------------------------------------------

export function LiveMatchdayPanel({ datum, ownTeam, href }: { datum: string; ownTeam: string; href?: string }) {
  const t = useTranslations("live");
  const data = useLiveMatchday(datum);
  if (!data || data.matches.length === 0) return null;
  const anyLive = data.matches.some((match) => match.status === "live");

  return (
    <section aria-labelledby="live-titel" className="mb-12">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 id="live-titel" className="h2">
          {t("title")}
        </h2>
        {anyLive ? <LiveBadge /> : null}
        <span className="ml-auto font-mono text-[12px] text-muted">{t("source")}</span>
        {href ? (
          <a href={href} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            {t("toMatchday")} →
          </a>
        ) : null}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {data.matches.map((match) => (
          <LiveMatchCard key={`${match.teams.join("-")}-${match.start}`} match={match} ownTeam={ownTeam} />
        ))}
      </div>
    </section>
  );
}

const clock = (time: number) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(new Date(time));

function LiveMatchCard({ match, ownTeam }: { match: LiveMatch; ownTeam: string }) {
  const t = useTranslations("live");
  const own = match.teams[0] === ownTeam ? 0 : match.teams[1] === ownTeam ? 1 : -1;
  const [open, setOpen] = useState(false);
  const courtId = useId();
  const now = useNow();
  const hasLineup = Boolean(match.lineup);
  // Vor dem Anpfiff: gemeldeter Kader, sobald er im Ticker steht
  const hasSquad = !hasLineup && Boolean(match.squads?.some((squad) => squad.length > 0));
  const expandable = hasLineup || hasSquad;
  const toggleLabel = hasLineup ? (open ? t("hideLineup") : t("showLineup")) : open ? t("hideSquad") : t("showSquad");
  const minutesToStart = now ? Math.ceil((match.start - now) / 60_000) : undefined;

  return (
    <article className={`card overflow-hidden ${match.status === "live" ? "live-card" : ""}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
        <span className="font-mono text-[12px] text-muted">
          {match.status === "pre" ? t("startsAt", { time: clock(match.start) }) : match.status === "live" ? t("running") : t("final")}
        </span>
        {match.status === "live" ? <LiveBadge /> : null}
      </div>

      {/* Anzeigetafel – Klick öffnet Feld und Aufstellung */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? courtId : undefined}
        className="block w-full px-5 py-5 text-left transition-colors enabled:hover:bg-surface/60 disabled:cursor-default"
      >
        <span className="sr-only">{expandable ? toggleLabel : ""}</span>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {[0, 1].map((index) => (
            <div key={index} className={`flex min-w-0 items-center gap-2 ${index === 1 ? "order-3 flex-row-reverse text-right" : ""}`}>
              <span className={`truncate text-[15px] ${own === index ? "font-semibold" : ""}`}>{match.teams[index]}</span>
              {match.serving === index ? (
                <span aria-label={t("serving")} title={t("serving")} className="serve-ball" />
              ) : null}
            </div>
          ))}
          <div className="order-2 text-center">
            <span className="block text-[2.25rem] leading-none font-semibold tracking-[-0.02em] tabular-nums">
              {match.status === "pre" ? "–:–" : match.sets.join(":")}
            </span>
            {match.current ? (
              <span className="mt-1 block font-mono text-[13px] text-muted tabular-nums">
                {t("setShort", { set: match.current.set })} · <span className="text-fg">{match.current.score.join(":")}</span>
              </span>
            ) : match.status === "pre" && minutesToStart !== undefined ? (
              <span className="mt-1.5 block font-mono text-[12.5px] whitespace-nowrap text-muted tabular-nums">
                {minutesToStart <= 0
                  ? t("kickoffSoon")
                  : minutesToStart < 60
                    ? t("kickoffInMinutes", { minutes: minutesToStart })
                    : t("kickoffInHours", { hours: Math.floor(minutesToStart / 60), minutes: minutesToStart % 60 })}
              </span>
            ) : null}
          </div>
        </div>
        {match.setScores.length > 0 ? (
          <ol className="mt-4 flex flex-wrap justify-center gap-1.5">
            {match.setScores.map(([a, b], index) => {
              const running = match.current && index === match.setScores.length - 1;
              return (
                <li
                  key={index}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[12px] tabular-nums ${running ? "border-accent-bright/50 text-fg" : "border-line text-muted"}`}
                >
                  {a}:{b}
                </li>
              );
            })}
          </ol>
        ) : null}
        {expandable ? (
          <span className="mt-4 flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-accent">
            {toggleLabel}
            <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
              ▾
            </span>
          </span>
        ) : match.status === "pre" ? (
          <span className="mt-4 block text-center text-[13px] text-muted">{t("lineupLater")}</span>
        ) : null}
      </button>

      {expandable && open ? (
        <div id={courtId} className="court-in border-t border-line px-4 py-5 sm:px-5">
          {hasLineup ? (
            <>
              <Court match={match} own={own} />
              <Legend match={match} own={own} />
            </>
          ) : (
            <SquadList match={match} own={own} />
          )}
        </div>
      ) : null}

      {match.events.length > 0 ? (
        <div className="border-t border-line px-5 py-4">
          <h3 className="eyebrow">{t("events")}</h3>
          <ol className="mt-3 space-y-1.5 text-[14px]">
            {match.events.slice(0, 6).map((event, index) => (
              <li key={`${event.time}-${index}`} className="flex gap-3">
                <span className="w-11 shrink-0 font-mono text-[12px] text-muted tabular-nums">{clock(event.time)}</span>
                <span>
                  <EventText event={event} teams={match.teams} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {match.scoresheetUrl ? (
        <div className="border-t border-line px-5 py-3">
          <a href={match.scoresheetUrl} rel="noopener" className="text-sm font-medium text-accent hover:underline">
            {t("scoresheet")}
          </a>
        </div>
      ) : null}
    </article>
  );
}

const fullName = (player?: LivePlayer) => (player ? `#${player.number} ${player.firstName} ${player.lastName}` : "?");

function EventText({ event, teams }: { event: LiveEvent; teams: [string, string] }) {
  const t = useTranslations("live");
  const team = event.team !== undefined ? teams[event.team] : "";
  const score = event.score ? event.score.join(":") : "";
  switch (event.type) {
    case "start":
      return <>{t("eventStart")}</>;
    case "set-start":
      return <>{t("eventSetStart", { set: event.set ?? 0 })}</>;
    case "set-won":
      return <>{t("eventSetWon", { team, set: event.set ?? 0, score })}</>;
    case "match-won":
      return <>{t("eventMatchWon", { team })}</>;
    case "timeout":
      return <>{t("eventTimeout", { team, score })}</>;
    case "substitution":
      return <>{t("eventSubstitution", { team, in: fullName(event.playerIn), out: fullName(event.playerOut) })}</>;
  }
}

// ---------------------------------------------------------------------------
// Feld mit Startaufstellung (Positionen I–VI) und Legende
// ---------------------------------------------------------------------------

// Koordinaten in Prozent: links Mannschaft 1 (Netz rechts), rechts Mannschaft 2.
// Aus Sicht jeder Mannschaft: vorne IV–III–II (links nach rechts), hinten V–VI–I.
const FRONT = [41.5, 58.5];
const BACK = [16, 84];
const SLOTS: Record<0 | 1, { x: number; y: number }[]> = {
  // Index 0–5 = Position I–VI
  0: [
    { x: BACK[0], y: 80 },
    { x: FRONT[0], y: 80 },
    { x: FRONT[0], y: 50 },
    { x: FRONT[0], y: 20 },
    { x: BACK[0], y: 20 },
    { x: BACK[0], y: 50 },
  ],
  1: [
    { x: BACK[1], y: 20 },
    { x: FRONT[1], y: 20 },
    { x: FRONT[1], y: 50 },
    { x: FRONT[1], y: 80 },
    { x: BACK[1], y: 80 },
    { x: BACK[1], y: 50 },
  ],
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

function Court({ match, own }: { match: LiveMatch; own: number }) {
  const t = useTranslations("live");
  const lineup = match.lineup!;
  return (
    <figure>
      <figcaption className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="eyebrow">{t("startingSix", { set: lineup.set })}</span>
        <span className="font-mono text-[11.5px] text-muted">{t("courtHint")}</span>
      </figcaption>
      <div className="court" role="img" aria-label={t("courtLabel", { set: lineup.set })}>
        <span aria-hidden="true" className="court-line court-attack" style={{ left: "33.33%" }} />
        <span aria-hidden="true" className="court-net" />
        <span aria-hidden="true" className="court-line court-attack" style={{ left: "66.66%" }} />
        {([0, 1] as const).map((team) =>
          lineup.teams[team].map((player, index) => {
            const slot = SLOTS[team][index];
            return (
              <span
                key={`${team}-${index}`}
                aria-hidden="true"
                className={`court-player ${own === team ? "is-own" : ""}`}
                style={{ left: `${slot.x}%`, top: `${slot.y}%`, animationDelay: `${(team * 6 + index) * 45}ms` }}
              >
                <span className="court-number">{player?.number ?? "?"}</span>
                <span className="court-name">{player?.lastName ?? ""}</span>
                {player?.captain ? <span className="court-captain">C</span> : null}
                {match.serving === team && index === 0 ? <span className="serve-ball court-serve" /> : null}
              </span>
            );
          }),
        )}
        <span aria-hidden="true" className="court-team court-team-left">
          {match.teams[0]}
        </span>
        <span aria-hidden="true" className="court-team court-team-right">
          {match.teams[1]}
        </span>
      </div>
    </figure>
  );
}

/** Vor dem Anpfiff: gemeldeter Kader beider Mannschaften */
function SquadList({ match, own }: { match: LiveMatch; own: number }) {
  const t = useTranslations("live");
  return (
    <>
      <p className="eyebrow">{t("squadTitle")}</p>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        {([0, 1] as const).map((team) => {
          const squad = match.squads?.[team] ?? [];
          return (
            <div key={team}>
              <h4 className={`text-[14.5px] ${own === team ? "font-semibold" : "font-medium"}`}>
                <span aria-hidden="true" className={`mr-2 inline-block size-2.5 rounded-full ${own === team ? "bg-btn" : "bg-fg/70"}`} />
                {match.teams[team]}
              </h4>
              {squad.length > 0 ? (
                <ol className="mt-2 space-y-1 text-[14px]">
                  {squad.map((player) => (
                    <li key={player.number} className="flex gap-2.5">
                      <span className="w-8 shrink-0 font-mono font-semibold tabular-nums">{player.number}</span>
                      <span>
                        {player.firstName} {player.lastName}
                        {player.captain ? <span className="ml-1.5 font-mono text-[11px] text-muted">({t("captain")})</span> : null}
                        {player.libero ? <span className="ml-1.5 font-mono text-[11px] text-muted">({t("libero")})</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-[13px] text-muted">{t("squadPending")}</p>
              )}
              {match.coaches?.[team] ? (
                <p className="mt-2 text-[13px] text-muted">
                  <span className="font-medium">{t("coach")}:</span> {match.coaches[team]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Legend({ match, own }: { match: LiveMatch; own: number }) {
  const t = useTranslations("live");
  const lineup = match.lineup!;
  return (
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      {([0, 1] as const).map((team) => {
        const onCourt = new Set(lineup.teams[team].filter(Boolean).map((player) => player!.number));
        const liberoNumbers = new Set(lineup.liberos[team].map((player) => player.number));
        const bench = (match.squads?.[team] ?? []).filter((player) => !onCourt.has(player.number) && !liberoNumbers.has(player.number));
        return (
          <div key={team}>
            <h4 className={`text-[14.5px] ${own === team ? "font-semibold" : "font-medium"}`}>
              <span aria-hidden="true" className={`mr-2 inline-block size-2.5 rounded-full ${own === team ? "bg-btn" : "bg-fg/70"}`} />
              {match.teams[team]}
            </h4>
            <ol className="mt-2 space-y-1 text-[14px]">
              {lineup.teams[team].map((player, index) => (
                <li key={index} className="flex gap-2.5">
                  <span className="w-7 shrink-0 font-mono text-[12px] text-muted">{ROMAN[index]}</span>
                  <span className="w-8 shrink-0 font-mono font-semibold tabular-nums">{player?.number ?? "?"}</span>
                  <span>
                    {player ? `${player.firstName} ${player.lastName}` : "–"}
                    {player?.captain ? <span className="ml-1.5 font-mono text-[11px] text-muted">({t("captain")})</span> : null}
                  </span>
                </li>
              ))}
              {lineup.liberos[team].map((player) => (
                <li key={`l-${player.number}`} className="flex gap-2.5">
                  <span className="w-7 shrink-0 font-mono text-[12px] text-muted">L</span>
                  <span className="w-8 shrink-0 font-mono font-semibold tabular-nums">{player.number}</span>
                  <span>
                    {player.firstName} {player.lastName} <span className="font-mono text-[11px] text-muted">({t("libero")})</span>
                  </span>
                </li>
              ))}
            </ol>
            {bench.length > 0 ? (
              <p className="mt-2 text-[13px] text-muted">
                <span className="font-medium">{t("bench")}:</span>{" "}
                {bench.map((player) => `${player.number} ${player.firstName} ${player.lastName}`).join(" · ")}
              </p>
            ) : null}
            {match.coaches?.[team] ? (
              <p className="mt-1 text-[13px] text-muted">
                <span className="font-medium">{t("coach")}:</span> {match.coaches[team]}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

