import type { Locale } from "@/i18n/routing";

import { type Fixture, type LeagueMatch, type Outcome, ownSets, type Season, type TableRow, type Venue } from "./content";

/*
 * Spieltage: Im Volleyball spielt man meist an Spieltagen mit drei
 * Mannschaften, jede zweimal. Ein Spieltag fasst die eigenen Spiele eines
 * Datums zusammen, dazu das dritte Spiel des Tages, Halle, Ausrichter und den
 * Tabellenplatz danach. Daraus entstehen Statistiken und ein automatischer
 * Bericht (src/app/[locale]/saison/[datum]/page.tsx).
 */

export type Matchday = {
  /** JJJJ-MM-TT */
  date: string;
  /** Beginn des ersten eigenen Spiels, HH:MM */
  time?: string;
  /** Eigene Spiele, in Spielreihenfolge */
  fixtures: Fixture[];
  /** Weitere Spiele desselben Spieltags ohne eigene Beteiligung */
  others: LeagueMatch[];
  home: boolean;
  host?: string;
  venue?: Venue;
  /** Alle eigenen Spiele haben ein Ergebnis */
  played: boolean;
  /** Tabellenplatz nach (und vor) diesem Spieltag laut Tabellenverlauf */
  position?: { after: number; before?: number };
  previous?: string;
  next?: string;
};

export const dayOf = (fixture: { date: string }) => fixture.date.slice(0, 10);

export function matchdayDates(season: Season): string[] {
  return [...new Set(season.fixtures.map(dayOf))].sort();
}

export function getMatchday(season: Season, date: string): Matchday | undefined {
  const fixtures = season.fixtures
    .filter((fixture) => dayOf(fixture) === date)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.number ?? 0) - (b.number ?? 0));
  if (fixtures.length === 0) return undefined;

  const dates = matchdayDates(season);
  const index = dates.indexOf(date);
  const own = fixtures[0].teams[fixtures[0].own];
  const participants = new Set(fixtures.flatMap((fixture) => fixture.teams));
  const others = season.matches.filter(
    (match) =>
      dayOf(match) === date &&
      !match.teams.includes(own) &&
      match.teams.every((team) => participants.has(team)),
  );

  const rankingIndex = season.ranking.findIndex((entry) => entry.date === date);
  const position =
    rankingIndex >= 0
      ? { after: season.ranking[rankingIndex].position, before: season.ranking[rankingIndex - 1]?.position }
      : undefined;

  return {
    date,
    time: fixtures[0].date.length > 10 ? fixtures[0].date.slice(11) : undefined,
    fixtures,
    others,
    home: fixtures.some((fixture) => fixture.home),
    host: fixtures.find((fixture) => fixture.host)?.host,
    venue: fixtures.find((fixture) => fixture.details?.venue)?.details?.venue,
    played: fixtures.every((fixture) => fixture.result),
    position: fixtures.every((fixture) => fixture.result) ? position : undefined,
    previous: index > 0 ? dates[index - 1] : undefined,
    next: index >= 0 && index < dates.length - 1 ? dates[index + 1] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Statistik eines Spiels (immer aus eigener Sicht)
// ---------------------------------------------------------------------------

/** Tabellenpunkte nach DVV: 3:0/3:1 → 3, 3:2 → 2, 2:3 → 1, sonst 0 */
export function leaguePoints(own: number, other: number): number {
  if (own === 3) return other <= 1 ? 3 : 2;
  return own === 2 && other === 3 ? 1 : 0;
}

export type MatchStats = {
  /** [eigene Sätze, Sätze des Gegners] */
  result: [number, number];
  sets: [number, number][];
  balls: [number, number];
  /** Laufender Satzstand nach jedem Satz, z. B. ["0:1", "1:1", "2:1", "3:1"] */
  course: string[];
  closest?: { set: number; score: [number, number] };
  points: number;
  tiebreak: boolean;
  /** Ersten Satz verloren und trotzdem gewonnen */
  comeback: boolean;
  /** Ersten Satz gewonnen und trotzdem verloren */
  lostLead: boolean;
};

export function matchStats(fixture: Fixture): MatchStats | undefined {
  if (!fixture.result) return undefined;
  const result: [number, number] = fixture.own === 0 ? fixture.result : [fixture.result[1], fixture.result[0]];
  const sets = ownSets(fixture);
  const fromSets = sets.reduce<[number, number]>((sum, [a, b]) => [sum[0] + a, sum[1] + b], [0, 0]);
  const official = fixture.details?.balls;
  const balls: [number, number] = official ? (fixture.own === 0 ? official : [official[1], official[0]]) : fromSets;

  const course: string[] = [];
  let won = 0;
  let lost = 0;
  for (const [a, b] of sets) {
    if (a > b) won += 1;
    else lost += 1;
    course.push(`${won}:${lost}`);
  }

  let closest: MatchStats["closest"];
  sets.forEach(([a, b], index) => {
    if (!closest || Math.abs(a - b) < Math.abs(closest.score[0] - closest.score[1])) closest = { set: index + 1, score: [a, b] };
  });

  const firstWon = sets[0] ? sets[0][0] > sets[0][1] : undefined;
  return {
    result,
    sets,
    balls,
    course,
    closest,
    points: leaguePoints(result[0], result[1]),
    tiebreak: sets.length === 5,
    comeback: result[0] === 3 && firstWon === false,
    lostLead: result[0] < 3 && firstWon === true,
  };
}

// ---------------------------------------------------------------------------
// Gegner
// ---------------------------------------------------------------------------

export type FormEntry = { date: string; opponent: string; score: [number, number]; outcome: Outcome };

/** Letzte Ergebnisse einer Mannschaft (aus ihrer Sicht), neueste zuletzt */
export function formOf(season: Season, team: string, limit = 4): FormEntry[] {
  return season.matches
    .filter((match) => match.result && match.teams.includes(team))
    .map((match) => {
      const index = match.teams[0] === team ? 0 : 1;
      const score: [number, number] = index === 0 ? match.result! : [match.result![1], match.result![0]];
      return { date: match.date, opponent: match.teams[1 - index], score, outcome: score[0] > score[1] ? ("win" as const) : ("loss" as const) };
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit);
}

export function tableRowOf(season: Season, team: string): TableRow | undefined {
  return season.table.find((row) => row.team === team);
}

/** Andere eigene Spiele gegen denselben Gegner in dieser Saison */
export function headToHead(season: Season, fixture: Fixture): Fixture[] {
  return season.fixtures.filter((other) => other !== fixture && other.opponent === fixture.opponent);
}

// ---------------------------------------------------------------------------
// Automatischer Bericht (Wir-Form, wie ein Spieltagsbericht auf einer
// Vereinsseite). Bewusst ohne Artikel vor Vereinsnamen („gegen TSV Pfuhl“),
// weil der/die je nach Verein wechselt.
// ---------------------------------------------------------------------------

const cityOf = (venue?: Venue) => venue?.city?.replace(/^\d{4,5}\s+/, "").trim() || undefined;

function longDate(date: string, locale: Locale): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const score = ([a, b]: [number, number]) => `${a}:${b}`;
const setList = (sets: [number, number][]) => sets.map(score).join(", ");

export type Report = { title: string; paragraphs: string[] };

type Kind = "win30" | "win31comeback" | "win31" | "win32" | "loss23" | "loss13lead" | "loss13" | "loss03";

/** Art des Spielverlaufs – bestimmt die Formulierung im Bericht */
function kindOf(stats: MatchStats): Kind {
  const [own, other] = stats.result;
  if (own === 3) return other === 0 ? "win30" : other === 1 ? (stats.comeback ? "win31comeback" : "win31") : "win32";
  if (own === 2) return "loss23";
  if (own === 1) return stats.lostLead ? "loss13lead" : "loss13";
  return "loss03";
}

export function matchdayReport(day: Matchday, season: Season, locale: Locale): Report {
  return locale === "de" ? reportDe(day, season) : reportEn(day, season);
}

function reportDe(day: Matchday, season: Season): Report {
  const city = cityOf(day.venue);
  const opponents = day.fixtures.map((fixture) => fixture.opponent);
  const where = city ? `in ${city}` : day.home ? "beim Heimspieltag" : day.host ? `bei ${day.host}` : "";
  const date = longDate(day.date, "de");

  if (!day.played) {
    const title = day.home ? "Heimspieltag" : day.host ? `Spieltag bei ${day.host}` : `Spiel gegen ${opponents[0]}`;
    const paragraphs = [
      `Am ${date}${day.time ? `, um ${day.time} Uhr,` : ","} ${
        day.home ? "haben wir Heimspieltag" : day.host ? `sind wir beim Spieltag von ${day.host} zu Gast` : "steht das nächste Spiel an"
      }. ${opponents.length > 1 ? `Gegner sind ${opponents.slice(0, -1).join(", ")} und ${opponents.at(-1)}.` : `Gegner ist ${opponents[0]}.`}`,
    ];
    for (const fixture of day.fixtures) {
      const row = tableRowOf(season, fixture.opponent);
      const earlier = headToHead(season, fixture).filter((other) => other.result && other.date < fixture.date);
      let sentence = row
        ? `${fixture.opponent} steht aktuell auf Platz ${row.position} (${row.won} ${row.won === 1 ? "Sieg" : "Siege"}, ${row.lost} ${row.lost === 1 ? "Niederlage" : "Niederlagen"}, Sätze ${row.sets}).`
        : "";
      const last = earlier.at(-1);
      const lastStats = last ? matchStats(last) : undefined;
      sentence += lastStats
        ? ` Das letzte Duell in dieser Saison ${lastStats.result[0] > lastStats.result[1] ? `haben wir mit ${score(lastStats.result)} gewonnen` : `ging mit ${score(lastStats.result)} verloren`}.`
        : ` Gegen ${fixture.opponent} ist es das erste Duell in dieser Saison.`;
      paragraphs.push(sentence.trim());
    }
    if (season.standing) {
      paragraphs.push(`Vor dem Spieltag stehen wir auf Platz ${season.standing.position}${season.standing.points !== undefined ? ` mit ${season.standing.points} ${season.standing.points === 1 ? "Punkt" : "Punkten"}` : ""}.`);
    }
    return { title, paragraphs };
  }

  const stats = day.fixtures.map((fixture) => matchStats(fixture)!);
  const wins = stats.filter((entry) => entry.result[0] > entry.result[1]).length;
  const dayPoints = stats.reduce((sum, entry) => sum + entry.points, 0);
  const n = stats.length;
  const tail = where ? ` ${where}` : "";
  const title =
    n === 1
      ? `${wins ? "Sieg" : "Niederlage"} gegen ${opponents[0]}`
      : wins === n
        ? `${n === 2 ? "Zwei" : n} Siege${tail}`
        : wins > 0
          ? `Sieg und Niederlage${tail}`
          : dayPoints > 0
            ? `${dayPoints === 1 ? "Ein Punkt" : `${dayPoints} Punkte`}${tail}`
            : `${n === 2 ? "Zwei" : n} Niederlagen${tail}`;

  const paragraphs: string[] = [];
  const intro = day.home
    ? "hatten wir Heimspieltag"
    : day.host
      ? `waren wir beim Spieltag von ${day.host} zu Gast`
      : "waren wir im Einsatz";
  const venue = day.venue ? ` (${[day.venue.name, city].filter(Boolean).join(", ")})` : "";
  paragraphs.push(
    `Am ${date}, ${intro}${venue}. ${n > 1 ? `Auf dem Programm standen ${n === 2 ? "zwei" : n} Spiele: gegen ${opponents.slice(0, -1).join(", ")} und gegen ${opponents.at(-1)}.` : ""}`.trim(),
  );

  const ordinals = ["ersten", "zweiten", "dritten"];
  let previousKind: string | undefined;
  day.fixtures.forEach((fixture, index) => {
    const s = stats[index];
    const opener = n > 1 ? `Im ${ordinals[index] ?? `${index + 1}.`} Spiel gegen ${fixture.opponent}` : `Gegen ${fixture.opponent}`;
    const kind = kindOf(s);
    // Gleicher Verlauf wie im Spiel davor: anders formulieren statt wiederholen
    const again = kind === previousKind;
    previousKind = kind;
    const sets = setList(s.sets);
    const close = s.closest && Math.abs(s.closest.score[0] - s.closest.score[1]) <= 3;
    const texts: Record<Kind, [string, string]> = {
      win30: [
        `${opener} gab es einen klaren 3:0-Sieg (${sets}).${close ? ` Eng wurde es nur im ${s.closest!.set}. Satz (${score(s.closest!.score)}).` : ""}`,
        `${opener} folgte ein weiterer glatter 3:0-Erfolg (${sets}).`,
      ],
      win31comeback: [
        `${opener} lagen wir nach dem ersten Satz (${score(s.sets[0])}) zurück, drehten das Spiel dann aber und gewannen 3:1 (${sets}).`,
        `${opener} gaben wir erneut den ersten Satz ab (${score(s.sets[0])}), drehten die Partie aber auch hier zum 3:1 (${sets}).`,
      ],
      win31: [`${opener} setzten wir uns mit 3:1 durch (${sets}).`, `${opener} gelang ebenfalls ein 3:1 (${sets}).`],
      win32: [
        `${opener} wurde es spannend: Nach ${s.course.slice(0, 4).join(", ")} fiel die Entscheidung erst im Tiebreak, den wir mit ${score(s.sets[4] ?? [0, 0])} gewannen.`,
        `${opener} ging es erneut in den Tiebreak, und wieder behielten wir mit ${score(s.sets[4] ?? [0, 0])} die Oberhand.`,
      ],
      loss23: [
        `${opener} ging es über die volle Distanz (${sets}). Den Tiebreak entschied ${fixture.opponent} mit ${s.sets[4]?.[1]}:${s.sets[4]?.[0]} für sich, beim 2:3 blieb uns immerhin ein Punkt.`,
        `${opener} fiel die Entscheidung abermals erst im Tiebreak, diesmal mit ${s.sets[4]?.[1]}:${s.sets[4]?.[0]} für ${fixture.opponent} – ein Punkt blieb trotzdem.`,
      ],
      loss13lead: [
        `${opener} gewannen wir zwar den ersten Satz (${score(s.sets[0])}), mussten uns am Ende aber mit 1:3 geschlagen geben (${sets}).`,
        `${opener} starteten wir erneut mit einem Satzgewinn (${score(s.sets[0])}), am Ende stand aber wieder ein 1:3 (${sets}).`,
      ],
      loss13: [`${opener} mussten wir uns mit 1:3 geschlagen geben (${sets}).`, `${opener} setzte es eine weitere 1:3-Niederlage (${sets}).`],
      loss03: [
        `${opener} war beim 0:3 nichts zu holen (${sets}).${close ? ` Am knappsten war der ${s.closest!.set}. Satz mit ${score(s.closest!.score)}.` : ""}`,
        `${opener} gab es eine weitere 0:3-Niederlage (${sets}).`,
      ],
    };
    const balls = index === 0 ? ` Nach Bällen stand es ${score(s.balls)}.` : ` Das Ballverhältnis: ${score(s.balls)}.`;
    paragraphs.push(texts[kind][again ? 1 : 0] + balls);
  });

  const known = day.fixtures.filter((fixture) => fixture.appearance);
  const playedCount = known.filter((fixture) => fixture.appearance?.status === "played").length;
  if (known.length > 0) {
    paragraphs.push(
      playedCount === known.length
        ? known.length === 2
          ? "Ich stand in beiden Spielen auf dem Feld."
          : "Ich stand auf dem Feld."
        : playedCount > 0
          ? `Ich kam in ${playedCount === 1 ? "einem" : playedCount} der ${known.length === 2 ? "beiden" : known.length} Spiele zum Einsatz.`
          : known.some((fixture) => fixture.appearance?.status === "squad")
            ? "Ich war im Kader, kam aber nicht zum Einsatz."
            : "An diesem Spieltag war ich nicht dabei.",
    );
  }

  const closing: string[] = [];
  for (const match of day.others) {
    if (!match.result) continue;
    const winner = match.result[0] > match.result[1] ? 0 : 1;
    closing.push(
      `Im dritten Spiel des Tages gewann ${match.teams[winner]} mit ${Math.max(...match.result)}:${Math.min(...match.result)} gegen ${match.teams[1 - winner]}.`,
    );
  }
  const pointsText = dayPoints === 0 ? "Ohne Punkte" : dayPoints === 1 ? "Mit einem Punkt" : `Mit ${dayPoints} Punkten`;
  closing.push(
    day.position
      ? `${pointsText} aus diesem Spieltag standen wir danach auf Platz ${day.position.after}${
          day.position.before !== undefined && day.position.before !== day.position.after ? ` (vorher ${day.position.before})` : ""
        }.`
      : `${pointsText} ging es nach Hause.`,
  );
  paragraphs.push(closing.join(" "));
  return { title, paragraphs };
}

function reportEn(day: Matchday, season: Season): Report {
  const city = cityOf(day.venue);
  const opponents = day.fixtures.map((fixture) => fixture.opponent);
  const where = city ? `in ${city}` : day.home ? "at home" : day.host ? `at ${day.host}` : "";
  const date = longDate(day.date, "en");
  const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

  if (!day.played) {
    const title = day.home ? "Home matchday" : day.host ? `Matchday at ${day.host}` : `Match against ${opponents[0]}`;
    const paragraphs = [
      `On ${date}${day.time ? `, at ${day.time},` : ","} ${
        day.home ? "we host the matchday" : day.host ? `we travel to the matchday hosted by ${day.host}` : "we play our next match"
      }. ${opponents.length > 1 ? `Our opponents are ${opponents.slice(0, -1).join(", ")} and ${opponents.at(-1)}.` : `Our opponent is ${opponents[0]}.`}`,
    ];
    for (const fixture of day.fixtures) {
      const row = tableRowOf(season, fixture.opponent);
      const earlier = headToHead(season, fixture).filter((other) => other.result && other.date < fixture.date);
      let sentence = row
        ? `${fixture.opponent} are currently ${ordinal(row.position)} (${plural(row.won, "win", "wins")}, ${plural(row.lost, "loss", "losses")}, sets ${row.sets}).`
        : "";
      const last = earlier.at(-1);
      const lastStats = last ? matchStats(last) : undefined;
      sentence += lastStats
        ? ` We ${lastStats.result[0] > lastStats.result[1] ? "won" : "lost"} the last meeting this season ${score(lastStats.result)}.`
        : ` It's our first meeting with ${fixture.opponent} this season.`;
      paragraphs.push(sentence.trim());
    }
    if (season.standing) {
      paragraphs.push(`Going into the matchday we're ${ordinal(season.standing.position)}${season.standing.points !== undefined ? ` with ${plural(season.standing.points, "point", "points")}` : ""}.`);
    }
    return { title, paragraphs };
  }

  const stats = day.fixtures.map((fixture) => matchStats(fixture)!);
  const wins = stats.filter((entry) => entry.result[0] > entry.result[1]).length;
  const dayPoints = stats.reduce((sum, entry) => sum + entry.points, 0);
  const n = stats.length;
  const tail = where ? ` ${where}` : "";
  const title =
    n === 1
      ? `${wins ? "Win" : "Defeat"} against ${opponents[0]}`
      : wins === n
        ? `${n === 2 ? "Two" : n} wins${tail}`
        : wins > 0
          ? `A win and a defeat${tail}`
          : dayPoints > 0
            ? `${dayPoints === 1 ? "One point" : `${dayPoints} points`}${tail}`
            : `${n === 2 ? "Two" : n} defeats${tail}`;

  const paragraphs: string[] = [];
  const intro = day.home ? "we hosted the matchday" : day.host ? `we played at the matchday hosted by ${day.host}` : "we were in action";
  const venue = day.venue ? ` (${[day.venue.name, city].filter(Boolean).join(", ")})` : "";
  paragraphs.push(
    `On ${date}, ${intro}${venue}. ${n > 1 ? `We had ${n === 2 ? "two" : n} matches: against ${opponents.slice(0, -1).join(", ")} and against ${opponents.at(-1)}.` : ""}`.trim(),
  );

  const ordinals = ["first", "second", "third"];
  let previousKind: string | undefined;
  day.fixtures.forEach((fixture, index) => {
    const s = stats[index];
    const opener = n > 1 ? `In the ${ordinals[index] ?? `${index + 1}th`} match against ${fixture.opponent}` : `Against ${fixture.opponent}`;
    const kind = kindOf(s);
    const again = kind === previousKind;
    previousKind = kind;
    const sets = setList(s.sets);
    const close = s.closest && Math.abs(s.closest.score[0] - s.closest.score[1]) <= 3;
    const texts: Record<Kind, [string, string]> = {
      win30: [
        `${opener} we won clearly, 3:0 (${sets}).${close ? ` Only set ${s.closest!.set} was close (${score(s.closest!.score)}).` : ""}`,
        `${opener} we followed up with another clean 3:0 (${sets}).`,
      ],
      win31comeback: [
        `${opener} we lost the first set (${score(s.sets[0])}) but turned the match around to win 3:1 (${sets}).`,
        `${opener} we dropped the first set again (${score(s.sets[0])}) and once more came back to win 3:1 (${sets}).`,
      ],
      win31: [`${opener} we won 3:1 (${sets}).`, `${opener} we also won 3:1 (${sets}).`],
      win32: [
        `${opener} it got tight: after ${s.course.slice(0, 4).join(", ")} the tie-break decided it, and we took it ${score(s.sets[4] ?? [0, 0])}.`,
        `${opener} it went to a tie-break again, and again we came out on top, ${score(s.sets[4] ?? [0, 0])}.`,
      ],
      loss23: [
        `${opener} it went the full distance (${sets}). ${fixture.opponent} took the tie-break ${s.sets[4]?.[1]}:${s.sets[4]?.[0]}, so the 2:3 still earned us a point.`,
        `${opener} the tie-break decided it once more, this time ${s.sets[4]?.[1]}:${s.sets[4]?.[0]} for ${fixture.opponent} – still a point.`,
      ],
      loss13lead: [
        `${opener} we won the first set (${score(s.sets[0])}) but lost 1:3 in the end (${sets}).`,
        `${opener} we again won the first set (${score(s.sets[0])}) but lost 1:3 again (${sets}).`,
      ],
      loss13: [`${opener} we lost 1:3 (${sets}).`, `${opener} we lost 1:3 again (${sets}).`],
      loss03: [
        `${opener} there was nothing in it for us, 0:3 (${sets}).${close ? ` The closest set was set ${s.closest!.set} at ${score(s.closest!.score)}.` : ""}`,
        `${opener} we lost 0:3 again (${sets}).`,
      ],
    };
    paragraphs.push(`${texts[kind][again ? 1 : 0]} Total points: ${score(s.balls)}.`);
  });

  const known = day.fixtures.filter((fixture) => fixture.appearance);
  const playedCount = known.filter((fixture) => fixture.appearance?.status === "played").length;
  if (known.length > 0) {
    paragraphs.push(
      playedCount === known.length
        ? known.length === 2
          ? "I played in both matches."
          : "I was on court."
        : playedCount > 0
          ? `I played in ${playedCount === 1 ? "one" : playedCount} of the ${known.length === 2 ? "two" : known.length} matches.`
          : known.some((fixture) => fixture.appearance?.status === "squad")
            ? "I was in the squad but didn't play."
            : "I wasn't involved on this matchday.",
    );
  }

  const closing: string[] = [];
  for (const match of day.others) {
    if (!match.result) continue;
    const winner = match.result[0] > match.result[1] ? 0 : 1;
    closing.push(`In the third match of the day ${match.teams[winner]} beat ${match.teams[1 - winner]} ${Math.max(...match.result)}:${Math.min(...match.result)}.`);
  }
  const pointsText = dayPoints === 0 ? "With no points" : dayPoints === 1 ? "With one point" : `With ${dayPoints} points`;
  closing.push(
    day.position
      ? `${pointsText} from the matchday we were ${ordinal(day.position.after)} afterwards${
          day.position.before !== undefined && day.position.before !== day.position.after ? ` (previously ${ordinal(day.position.before)})` : ""
        }.`
      : `${pointsText} from the matchday.`,
  );
  paragraphs.push(closing.join(" "));
  return { title, paragraphs };
}

function ordinal(value: number): string {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][value % 10] ?? "th");
  return `${value}${suffix}`;
}
