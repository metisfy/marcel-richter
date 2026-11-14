import "server-only";

/*
 * Live-Spielstand aus dem BVV-Live-Ticker (SAMS Ticker, bvv.sams-ticker.de).
 *
 * Der Server hält EINE Verbindung zum Ticker (WebSocket) und den Stand der
 * Spiele der eigenen Mannschaft im Speicher. Browser fragen nur unseren
 * Server (/api/live/<datum>), nie den Ticker direkt – keine Verbindung zu
 * Dritten im Browser, und der Ticker sieht nur einen Abrufer.
 *
 * ACHTUNG: Das Ticker-Backend beantwortet nur Anfragen mit dem Origin der
 * offiziellen Ticker-Seite. Diesen Header senden wir mit (Entscheidung des
 * Betreibers, 14.11.2026). Eine Erlaubnis beim BVV/SAMS sollte eingeholt
 * werden; ohne sie kann der Anbieter das jederzeit sperren – dann zeigt die
 * Seite einfach keinen Live-Stand.
 *
 * Ohne Besucher (15 Minuten keine Anfrage) wird die Verbindung geschlossen.
 */

const TICKER = "bvv";
const REST_URL = `https://backend.sams-ticker.de/live/indoor/tickers/${TICKER}`;
const SOCKET_URL = `wss://backend.sams-ticker.de/indoor/${TICKER}`;
const HEADERS = {
  Origin: "https://bvv.sams-ticker.de",
  "User-Agent": "Mozilla/5.0 (compatible; spielplan-abruf/1.0)",
  Accept: "application/json",
};
const IDLE_MS = 15 * 60_000;

type Score = { team1: number; team2: number };
type Lineup = { playerUuids: string[]; defaultLiberoUuid: string | null };
type Person = { uuid: string; firstName: string; lastName: string; jerseyNumber?: string; function?: string };
type TeamSquad = { players: Person[]; liberos: Person[]; captain: Person | null; officials: Person[] };
type TickerEvent = {
  type: string;
  timestamp: number;
  teamCode?: "team1" | "team2";
  setNumber?: number;
  setScore?: Score;
  setPoints?: Score;
  lineups?: { team1: Lineup; team2: Lineup };
  teamSquad?: TeamSquad;
  playerInUuid?: string;
  playerOutUuid?: string;
};
type TickerState = {
  matchUuid: string;
  started: boolean;
  finished: boolean;
  setPoints: Score;
  serving: "team1" | "team2" | null;
  matchSets: { setScore: Score; setNumber: number }[];
  scoresheetPdfUrl?: string;
  eventHistory: TickerEvent[];
  teamLineups?: { team1: Lineup; team2: Lineup };
};
type TickerMatch = { id: string; teamDescription1: string; teamDescription2: string; date: number; matchSeries?: string };

// Ein Zustand pro Server-Prozess (auch über Hot-Reloads in der Entwicklung)
type Hub = {
  /** Mannschaft (und Liga), für die die Spiele geladen sind */
  key?: string;
  matches: Map<string, TickerMatch>;
  states: Map<string, TickerState>;
  loadedAt: number;
  lastUsed: number;
  loading?: Promise<void>;
  socket?: WebSocket;
  idleTimer?: ReturnType<typeof setInterval>;
};
const globalHub = globalThis as unknown as { __liveHub?: Hub };
const hub: Hub = (globalHub.__liveHub ??= { matches: new Map(), states: new Map(), loadedAt: 0, lastUsed: 0 });

async function loadSnapshot(team: string, series?: string) {
  const response = await fetch(REST_URL, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Ticker antwortet mit HTTP ${response.status}`);
  const data = (await response.json()) as {
    matchDays: { matches: TickerMatch[] }[];
    matchSeries?: Record<string, { name?: string }>;
    matchStates: Record<string, TickerState>;
  };
  hub.matches.clear();
  hub.states.clear();
  for (const day of data.matchDays) {
    for (const match of day.matches) {
      if (match.teamDescription1 !== team && match.teamDescription2 !== team) continue;
      // Gleichnamige Mannschaften anderer Ligen (Damen, Jugend) auslassen
      if (series && data.matchSeries?.[match.matchSeries ?? ""]?.name !== series) continue;
      hub.matches.set(match.id, { id: match.id, teamDescription1: match.teamDescription1, teamDescription2: match.teamDescription2, date: match.date });
      const state = data.matchStates[match.id];
      if (state) hub.states.set(match.id, state);
    }
  }
  hub.key = keyOf(team, series);
  hub.loadedAt = Date.now();
}

function openSocket() {
  if (hub.socket && hub.socket.readyState <= 1) return;
  // Node.js (undici) erlaubt eigene Header beim Verbindungsaufbau
  const socket = new WebSocket(SOCKET_URL, { headers: HEADERS } as unknown as string[]);
  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(String(event.data)) as { type: string; payload?: TickerState };
      if (message.type === "MATCH_UPDATE" && message.payload && hub.matches.has(message.payload.matchUuid)) {
        hub.states.set(message.payload.matchUuid, message.payload);
      }
    } catch {
      // unlesbare Nachricht – ignorieren
    }
  });
  socket.addEventListener("close", () => {
    if (hub.socket === socket) hub.socket = undefined;
  });
  socket.addEventListener("error", () => socket.close());
  hub.socket = socket;

  hub.idleTimer ??= setInterval(() => {
    if (Date.now() - hub.lastUsed < IDLE_MS) return;
    hub.socket?.close();
    hub.socket = undefined;
    hub.loadedAt = 0;
    hub.states.clear();
    clearInterval(hub.idleTimer);
    hub.idleTimer = undefined;
  }, 60_000);
  hub.idleTimer.unref?.();
}

/** Sorgt für aktuelle Daten: Schnappschuss (höchstens jede Minute neu, solange keine Verbindung steht) + Verbindung. */
const keyOf = (team: string, series?: string) => `${team}|${series ?? ""}`;

async function ensure(team: string, series?: string) {
  hub.lastUsed = Date.now();
  const stale = hub.key !== keyOf(team, series) || !hub.loadedAt || (!hub.socket && Date.now() - hub.loadedAt > 60_000);
  if (stale) {
    hub.loading ??= loadSnapshot(team, series).finally(() => {
      hub.loading = undefined;
    });
    await hub.loading;
  }
  openSocket();
}

// ---------------------------------------------------------------------------
// Aufbereitung für die Website
// ---------------------------------------------------------------------------

export type LivePlayer = { number: string; firstName: string; lastName: string; captain: boolean; libero: boolean };
export type LiveEvent = {
  time: number;
  type: "start" | "set-start" | "set-won" | "match-won" | "timeout" | "substitution";
  team?: 0 | 1;
  set?: number;
  score?: [number, number];
  playerIn?: LivePlayer;
  playerOut?: LivePlayer;
};
export type LiveMatch = {
  teams: [string, string];
  start: number;
  status: "pre" | "live" | "post";
  sets: [number, number];
  setScores: [number, number][];
  current?: { set: number; score: [number, number] };
  serving?: 0 | 1;
  /** Startaufstellung des laufenden (bzw. letzten) Satzes, Positionen I–VI */
  lineup?: { set: number; teams: [(LivePlayer | null)[], (LivePlayer | null)[]]; liberos: [LivePlayer[], LivePlayer[]] };
  /** Kader beider Mannschaften (für die Legende) */
  squads?: [LivePlayer[], LivePlayer[]];
  coaches?: [string | undefined, string | undefined];
  events: LiveEvent[];
  scoresheetUrl?: string;
};

const tidy = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const pair = (score: Score | undefined): [number, number] => [score?.team1 ?? 0, score?.team2 ?? 0];
const teamIndex = (code?: string): 0 | 1 | undefined => (code === "team1" ? 0 : code === "team2" ? 1 : undefined);

/** Datum (JJJJ-MM-TT) eines Zeitpunkts in deutscher Zeit */
const berlinDay = (time: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date(time));

function toLive(match: TickerMatch, state: TickerState | undefined): LiveMatch {
  const teams: [string, string] = [match.teamDescription1, match.teamDescription2];
  const base: LiveMatch = { teams, start: match.date, status: "pre", sets: [0, 0], setScores: [], events: [] };
  if (!state) return base;

  const history = [...(state.eventHistory ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  const squadEvents: [TeamSquad | undefined, TeamSquad | undefined] = [undefined, undefined];
  for (const event of history) {
    const index = teamIndex(event.teamCode);
    if (event.type === "CONFIRM_TEAMSQUAD" && event.teamSquad && index !== undefined) squadEvents[index] = event.teamSquad;
  }
  const playerOf = (index: 0 | 1, uuid?: string | null): LivePlayer | null => {
    const squad = squadEvents[index];
    const person = uuid ? squad?.players.find((player) => player.uuid === uuid) : undefined;
    if (!person) return null;
    return {
      number: person.jerseyNumber ?? "",
      firstName: tidy(person.firstName),
      lastName: tidy(person.lastName),
      captain: squad?.captain?.uuid === person.uuid,
      libero: Boolean(squad?.liberos.some((libero) => libero.uuid === person.uuid)),
    };
  };
  const squads = ([0, 1] as const).map((index) =>
    (squadEvents[index]?.players ?? [])
      .map((player) => playerOf(index, player.uuid)!)
      .sort((a, b) => Number(a.number) - Number(b.number)),
  ) as [LivePlayer[], LivePlayer[]];

  const coach = (index: 0 | 1) => {
    const trainer = squadEvents[index]?.officials.find((official) => official.function === "TRAINER");
    return trainer ? tidy(`${trainer.firstName} ${trainer.lastName}`) : undefined;
  };
  // Vor dem Anpfiff: Kader, sobald die Mannschaften ihn im Ticker bestätigt haben
  if (!state.started) {
    return squads.some((squad) => squad.length > 0) ? { ...base, squads, coaches: [coach(0), coach(1)] } : base;
  }

  // Startaufstellung: Beginn des laufenden Satzes (START_SET), sonst Spielbeginn
  const lineupEvent = [...history].reverse().find((event) => (event.type === "START_SET" || event.type === "START_MATCH") && event.lineups);
  const lineup = lineupEvent?.lineups
    ? {
        set: lineupEvent.setNumber ?? 1,
        teams: ([0, 1] as const).map((index) =>
          (index === 0 ? lineupEvent.lineups!.team1 : lineupEvent.lineups!.team2).playerUuids.map((uuid) => playerOf(index, uuid)),
        ) as [(LivePlayer | null)[], (LivePlayer | null)[]],
        liberos: ([0, 1] as const).map((index) => (squadEvents[index]?.liberos ?? []).map((libero) => playerOf(index, libero.uuid)!).filter(Boolean)) as [
          LivePlayer[],
          LivePlayer[],
        ],
      }
    : undefined;

  const events: LiveEvent[] = [];
  for (const event of history) {
    const team = teamIndex(event.teamCode);
    const common = { time: event.timestamp, team, set: event.setNumber, score: event.setScore ? pair(event.setScore) : undefined };
    if (event.type === "START_MATCH") events.push({ ...common, type: "start" });
    else if (event.type === "START_SET" && (event.setNumber ?? 1) > 1) events.push({ ...common, type: "set-start" });
    else if (event.type === "SET_BALL_SUCCESS") events.push({ ...common, type: "set-won" });
    else if (event.type === "MATCH_BALL_SUCCESS") events.push({ ...common, type: "match-won" });
    else if (event.type === "START_TIMEOUT") events.push({ ...common, type: "timeout" });
    else if (event.type === "SUBSTITUTION" && team !== undefined) {
      events.push({ ...common, type: "substitution", playerIn: playerOf(team, event.playerInUuid) ?? undefined, playerOut: playerOf(team, event.playerOutUuid) ?? undefined });
    }
  }

  const sets = state.matchSets ?? [];
  const last = sets.at(-1);
  return {
    teams,
    start: match.date,
    status: state.finished ? "post" : "live",
    sets: pair(state.setPoints),
    setScores: sets.map((set) => pair(set.setScore)),
    current: !state.finished && last ? { set: last.setNumber, score: pair(last.setScore) } : undefined,
    serving: state.finished ? undefined : teamIndex(state.serving ?? undefined),
    lineup,
    squads,
    coaches: [coach(0), coach(1)],
    events: events.slice(-12).reverse(),
    scoresheetUrl: state.finished ? state.scoresheetPdfUrl : undefined,
  };
}

/**
 * Live-Stand aller Spiele der eigenen Mannschaft an einem Tag (JJJJ-MM-TT).
 * `series`: Name der Liga im Ticker, trennt gleichnamige Mannschaften.
 */
export async function liveMatchday(team: string, date: string, series?: string): Promise<LiveMatch[]> {
  await ensure(team, series);
  return [...hub.matches.values()]
    .filter((match) => berlinDay(match.date) === date)
    .sort((a, b) => a.date - b.date)
    .map((match) => toLive(match, hub.states.get(match.id)));
}
