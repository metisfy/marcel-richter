import "server-only";

import fs from "node:fs";
import path from "node:path";

import { cache } from "react";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import type { Locale } from "@/i18n/routing";

/*
 * Alle Inhalte liegen unter /content (YAML + MDX) und werden beim Build
 * gelesen. Jede Datei wird gegen ein Schema geprüft: Ein Tippfehler in einer
 * Inhaltsdatei bricht den Build mit einer verständlichen Meldung ab, statt
 * still eine kaputte Seite auszuliefern.
 */

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content");
const PUBLIC_DIR = path.join(ROOT, "public");
const SHOW_DRAFTS = process.env.NODE_ENV === "development";

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/** Text, der entweder für beide Sprachen gilt oder je Sprache angegeben ist. */
const localized = z.union([
  z.string(),
  z.object({ de: z.string(), en: z.string().optional() }),
]);
export type Localized = z.infer<typeof localized>;

/** Wählt die passende Sprachfassung; fehlt Englisch, gilt Deutsch. */
export function pick(value: Localized, locale: Locale): string;
export function pick(
  value: Localized | undefined,
  locale: Locale,
): string | undefined;
export function pick(value: Localized | undefined, locale: Locale) {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  return value[locale] ?? value.de;
}

const imageSrc = z
  .string()
  .regex(
    /^\/images\/[\w\-./]+\.(jpe?g|png|webp|avif|svg)$/i,
    "Bildpfad muss mit /images/ beginnen und auf .jpg, .png, .webp, .avif oder .svg enden",
  )
  .superRefine((src, ctx) => {
    if (!fs.existsSync(path.join(PUBLIC_DIR, src))) {
      ctx.addIssue({
        code: "custom",
        message: `Bilddatei nicht gefunden: public${src}`,
      });
    }
  });

const slug = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Nur Kleinbuchstaben, Ziffern und Bindestriche",
  );

const link = z.object({ label: z.string(), url: z.url() });

// ---------------------------------------------------------------------------
// Datei-Helfer
// ---------------------------------------------------------------------------

function fail(file: string, error: z.ZodError): never {
  throw new Error(
    `Ungültiger Inhalt in ${path.relative(ROOT, file)}:\n${z.prettifyError(error)}`,
  );
}

function loadYaml<S extends z.ZodType>(relPath: string, schema: S): z.output<S> {
  const file = path.join(CONTENT_DIR, relPath);
  const raw: unknown = parseYaml(fs.readFileSync(file, "utf8"));
  const result = schema.safeParse(raw);
  if (!result.success) fail(file, result.error);
  return result.data;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function readMdx(file: string): { data: Record<string, unknown>; body: string } {
  const source = fs.readFileSync(file, "utf8");
  const match = FRONTMATTER.exec(source);
  if (!match) return { data: {}, body: source };
  const data: unknown = parseYaml(match[1]) ?? {};
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Frontmatter in ${path.relative(ROOT, file)} ist kein Objekt.`);
  }
  return { data: data as Record<string, unknown>, body: match[2] };
}

/**
 * Liest `<basis>.de.mdx` bzw. `<basis>/de.mdx` und optional die englische
 * Fassung. Englisch übernimmt alle Frontmatter-Felder, die es nicht selbst
 * setzt, aus der deutschen Datei. Fehlt die englische Datei ganz, wird die
 * deutsche angezeigt (contentLocale verrät das der Seite).
 */
function readLocalizedMdx(
  fileFor: (locale: Locale) => string,
  locale: Locale,
): { data: Record<string, unknown>; body: string; contentLocale: Locale; file: string } {
  const deFile = fileFor("de");
  const de = readMdx(deFile);
  if (locale === "de") return { ...de, contentLocale: "de", file: deFile };

  const localeFile = fileFor(locale);
  if (!fs.existsSync(localeFile)) return { ...de, contentLocale: "de", file: deFile };

  const translated = readMdx(localeFile);
  return {
    data: { ...de.data, ...translated.data },
    body: translated.body,
    contentLocale: locale,
    file: localeFile,
  };
}

// ---------------------------------------------------------------------------
// Website-Stammdaten: content/site.yaml
// ---------------------------------------------------------------------------

const siteSchema = z.object({
  name: z.string(),
  jobTitle: localized,
  tagline: localized,
  intro: localized,
  highlights: z.array(z.object({ title: localized, text: localized })).default([]),
  location: localized.optional(),
  email: z.email(),
  portrait: imageSrc,
  portraitAlt: localized,
  socials: z.array(link).default([]),
  /** Unternehmen, für das die Person arbeitet (Rolle, Firma, Projekte) */
  company: z
    .object({
      name: z.string(),
      legalName: z.string(),
      url: z.url(),
      role: localized,
      city: z.string().optional(),
      projects: z.array(z.object({ name: z.string(), url: z.url(), description: localized.optional() })).default([]),
    })
    .optional(),
  /** Rechteinhaber für den Copyright-Vermerk; leer = Name der Person */
  copyright: z.array(z.object({ label: z.string(), url: z.url().optional() })).default([]),
  team: z.object({
    name: z.string(),
    sport: localized,
    league: localized.optional(),
    url: z.url().optional(),
    logo: imageSrc.optional(),
    position: localized.optional(),
    number: z.number().int().optional(),
    since: z.number().int().optional(),
  }),
});

export type Site = ReturnType<typeof resolveSite>;

function resolveSite(raw: z.output<typeof siteSchema>, locale: Locale) {
  return {
    ...raw,
    jobTitle: pick(raw.jobTitle, locale),
    tagline: pick(raw.tagline, locale),
    intro: pick(raw.intro, locale),
    highlights: raw.highlights.map((item) => ({ title: pick(item.title, locale), text: pick(item.text, locale) })),
    location: pick(raw.location, locale),
    portraitAlt: pick(raw.portraitAlt, locale),
    company: raw.company
      ? {
          ...raw.company,
          role: pick(raw.company.role, locale),
          projects: raw.company.projects.map((project) => ({ ...project, description: pick(project.description, locale) })),
        }
      : undefined,
    team: {
      ...raw.team,
      sport: pick(raw.team.sport, locale),
      league: pick(raw.team.league, locale),
      position: pick(raw.team.position, locale),
    },
  };
}

export const getSite = cache((locale: Locale) =>
  resolveSite(loadYaml("site.yaml", siteSchema), locale),
);

/** Kurzzeile über dem Namen: „Geschäftsführer · metisOne“ (ohne Firma: Position · Verein) */
export function roleLine(site: Site): string {
  if (site.company) return `${site.company.role} · ${site.company.name}`;
  return [site.team.position, site.team.name].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// Projekte: content/projekte/<slug>/de.mdx (+ en.mdx)
// ---------------------------------------------------------------------------

const PROJECTS_DIR = path.join(CONTENT_DIR, "projekte");

const projectSchema = z.object({
  title: z.string(),
  summary: z.string(),
  /** "JJJJ", "JJJJ-MM" oder "JJJJ-MM-TT" – je nachdem, wie genau es bekannt ist */
  date: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Datum als "JJJJ", "JJJJ-MM" oder "JJJJ-MM-TT" angeben'),
  cover: imageSrc,
  coverAlt: z.string(),
  /** Screenshot der ganzen Seite, läuft auf der Projektseite im Browserfenster durch */
  screenshot: imageSrc.optional(),
  role: z.string().optional(),
  /** Auftraggeber, z. B. „Gastronomie“ oder „metisOne · Eigenprojekt“ */
  client: z.string().optional(),
  /** z. B. „Live“, „In Aufbau“ */
  status: z.string().optional(),
  /** Umgesetzt von, z. B. „metisCode“ */
  company: z.string().optional(),
  category: z.string().optional(),
  /** Reihenfolge in Listen (kleiner = weiter vorn); ohne Angabe nach Datum */
  order: z.number().int().optional(),
  tags: z.array(z.string()).default([]),
  links: z.array(link).default([]),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
});

export type Project = z.output<typeof projectSchema> & {
  slug: string;
  body: string;
  contentLocale: Locale;
};

function projectSlugs(): string[] {
  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(PROJECTS_DIR, name, "de.mdx")))
    .sort();
}

function loadProject(name: string, locale: Locale): Project {
  const checked = slug.safeParse(name);
  if (!checked.success) fail(path.join(PROJECTS_DIR, name), checked.error);

  const { data, body, contentLocale, file } = readLocalizedMdx(
    (l) => path.join(PROJECTS_DIR, name, `${l}.mdx`),
    locale,
  );
  const result = projectSchema.safeParse(data);
  if (!result.success) fail(file, result.error);
  return { ...result.data, slug: name, body, contentLocale };
}

export const getProjects = cache((locale: Locale): Project[] =>
  projectSlugs()
    .map((name) => loadProject(name, locale))
    .filter((project) => SHOW_DRAFTS || !project.draft)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || b.date.localeCompare(a.date)),
);

/**
 * Breite und Höhe eines Bildes aus public/ (JPEG oder PNG), direkt aus dem
 * Dateikopf gelesen – für Bilder, deren Seitenverhältnis die Darstellung
 * bestimmt (z. B. durchlaufende Seiten-Screenshots).
 */
export const imageSize = cache((src: string): { width: number; height: number } | undefined => {
  const buffer = fs.readFileSync(path.join(PUBLIC_DIR, src));
  // PNG: Breite/Höhe im IHDR-Block ab Byte 16
  if (buffer.readUInt32BE(0) === 0x89504e47) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  // JPEG: Segmente durchgehen bis zum Start-of-Frame (SOF0–SOF15 außer DHT/JPG/DAC)
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return undefined;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return undefined;
});

export const getProject = cache((locale: Locale, name: string) =>
  getProjects(locale).find((project) => project.slug === name),
);

// ---------------------------------------------------------------------------
// Einzelseiten: content/seiten/<name>.<sprache>.mdx
// ---------------------------------------------------------------------------

export type PageName = "ueber-mich" | "impressum" | "datenschutz";

const pageSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const getPage = cache((name: PageName, locale: Locale) => {
  const { data, body, contentLocale, file } = readLocalizedMdx(
    (l) => path.join(CONTENT_DIR, "seiten", `${name}.${l}.mdx`),
    locale,
  );
  const result = pageSchema.safeParse(data);
  if (!result.success) fail(file, result.error);
  return { ...result.data, body, contentLocale };
});

// ---------------------------------------------------------------------------
// Saisons: content/saison/<JJJJ-JJ>.yaml — die neueste Datei ist die aktuelle
//
// Spielplan, Ergebnisse und Tabelle kommen entweder aus der Datei selbst
// (fixtures, standing) oder live vom Bayerischen Volleyball-Verband (bvv).
// Das Zusammenführen mit den Live-Daten übernimmt src/lib/season.ts.
// ---------------------------------------------------------------------------

const SEASON_DIR = path.join(CONTENT_DIR, "saison");

const seasonSchema = z.object({
  season: z.string(),
  league: localized,
  summary: localized.optional(),
  bvv: z
    .object({
      url: z
        .url()
        .regex(
          /^https:\/\/volleyball\.bayern\/ergebnisse\/.+\/wettbewerb-\d+$/,
          'Ligaseite des BVV angeben, z. B. "https://volleyball.bayern/ergebnisse/erwachsene/schwaben/wettbewerb-44600"',
        ),
      /** Name der eigenen Mannschaft genau wie auf der BVV-Seite; Standard: team.name aus site.yaml */
      team: z.string().optional(),
      /** Eigener Name wie im Spielbericht, für „Meine Einsätze“; Standard: name aus site.yaml */
      player: z.object({ lastName: z.string(), firstName: z.string() }).optional(),
    })
    .optional(),
  standing: z
    .object({
      position: z.number().int().positive(),
      teams: z.number().int().positive(),
      points: z.number().int().nonnegative().optional(),
    })
    .optional(),
  stats: z
    .array(
      z.object({
        label: localized,
        value: z.union([z.string(), z.number()]),
      }),
    )
    .default([]),
  fixtures: z
    .array(
      z
        .object({
          date: z
            .string()
            .regex(
              /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/,
              'Format "JJJJ-MM-TT" oder "JJJJ-MM-TT HH:MM" (deutsche Ortszeit)',
            ),
          opponent: z.string(),
          home: z.boolean(),
          venue: z.string().optional(),
          competition: localized.optional(),
          result: z
            .string()
            .regex(/^\d+:\d+$/, 'Sätze als "Heim:Gast", z. B. "3:1"')
            .optional(),
          sets: z
            .string()
            .regex(
              /^\d+:\d+( \d+:\d+)*$/,
              'Satzergebnisse aus Sicht der Heimmannschaft, mit Leerzeichen getrennt, z. B. "25:21 22:25 25:19 25:17"',
            )
            .optional(),
          note: localized.optional(),
        })
        .superRefine((fixture, ctx) => {
          if (!fixture.result) {
            if (fixture.sets) {
              ctx.addIssue({ code: "custom", path: ["sets"], message: "Satzergebnisse ohne result – bitte auch result eintragen" });
            }
            return;
          }
          const [home, away] = fixture.result.split(":").map(Number);
          if (home === away) {
            ctx.addIssue({ code: "custom", path: ["result"], message: `Unentschieden gibt es im Volleyball nicht (${fixture.result})` });
          }
          if (!fixture.sets) return;
          const sets = fixture.sets.split(" ").map((set) => set.split(":").map(Number));
          const homeSets = sets.filter(([h, a]) => h > a).length;
          const awaySets = sets.filter(([h, a]) => a > h).length;
          if (homeSets !== home || awaySets !== away) {
            ctx.addIssue({
              code: "custom",
              path: ["sets"],
              message: `Sätze ergeben ${homeSets}:${awaySets}, result sagt ${fixture.result} (${fixture.date}, ${fixture.opponent})`,
            });
          }
        }),
    )
    .default([]),
});

export type Outcome = "win" | "loss";

export type Venue = { name: string; street?: string; city?: string; lat?: number; lng?: number };

/** Ein Spiel der ganzen Liga (für Gegner-Form, drittes Spiel des Spieltags usw.) */
export type LeagueMatch = {
  date: string;
  number?: number;
  teams: [string, string];
  host?: string;
  result?: [number, number];
  sets: string[];
};

export type Fixture = {
  /** "JJJJ-MM-TT" oder "JJJJ-MM-TT HH:MM", deutsche Ortszeit */
  date: string;
  /** Spielnummer laut Verband */
  number?: number;
  /** Beide Mannschaften in der offiziellen Reihenfolge (Heim bzw. Team A zuerst) */
  teams: [string, string];
  /** Position der eigenen Mannschaft in `teams` */
  own: 0 | 1;
  opponent: string;
  /** Gespielt in der eigenen Halle (Heimspiel bzw. eigener Spieltag) */
  home: boolean;
  /** Ausrichter des Spieltags, falls nicht die eigene Mannschaft */
  host?: string;
  venue?: string;
  competition?: string;
  note?: string;
  /** Endstand in Sätzen, Reihenfolge wie `teams` */
  result?: [number, number];
  /** Einzelne Sätze, Reihenfolge wie `teams`, z. B. ["25:21", "22:25"] */
  sets: string[];
  outcome?: Outcome;
  /** Spielseite beim Verband */
  url?: string;
  /**
   * Eigener Einsatz laut Spielbericht (nur gespielte Spiele mit BVV-Daten):
   * played = eingesetzt, squad = im Spielbericht, aber nicht eingesetzt,
   * absent = nicht im Spielbericht
   */
  appearance?: { status: "played" | "squad" | "absent"; libero: boolean };
  /** Angaben von der Spielseite des Verbands */
  details?: {
    referee?: string;
    venue?: Venue;
    /** Bälle, Reihenfolge wie `teams` */
    balls?: [number, number];
    /** Eigene Mannschaft im Spielbericht: Spieler gesamt und davon eingesetzt */
    squad?: { listed: number; played: number };
  };
};

export type TableRow = {
  position: number;
  team: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  sets: string;
  balls: string;
  own: boolean;
};

export type Season = {
  id: string;
  season: string;
  league: string;
  summary?: string;
  standing?: { position: number; teams: number; points?: number };
  stats: { label: string; value: string | number }[];
  fixtures: Fixture[];
  /** Ligatabelle (nur mit Live-Daten) */
  table: TableRow[];
  /** Bilanz der eigenen Mannschaft (nur mit Live-Daten) */
  record?: Pick<TableRow, "played" | "won" | "lost" | "sets" | "balls">;
  /** Alle Spiele der Liga (nur mit Live-Daten) */
  matches: LeagueMatch[];
  /** Tabellenplatz der eigenen Mannschaft nach jedem Spieltag (nur mit Live-Daten) */
  ranking: { date: string; position: number }[];
  /** Eigene Einsätze: eingesetzt in `played` von `matches` Spielen mit Spielbericht */
  appearances?: { played: number; squad: number; matches: number };
  /** Live-Quelle; `updatedAt` fehlt, wenn der Abruf gescheitert ist */
  source?: { url: string; team: string; player: { lastName: string; firstName: string }; updatedAt?: string };
};

export function outcomeOf(own: 0 | 1, result: [number, number]): Outcome {
  return result[own] > result[own === 0 ? 1 : 0] ? "win" : "loss";
}

export const getSeasons = cache((locale: Locale): Season[] => {
  const site = getSite(locale);
  const teamName = site.team.name;
  // „Marcel Richter“ → Vorname „Marcel“, Nachname „Richter“
  const nameParts = site.name.trim().split(/\s+/);
  const defaultPlayer = { lastName: nameParts.at(-1) ?? site.name, firstName: nameParts.slice(0, -1).join(" ") };
  return fs
    .readdirSync(SEASON_DIR)
    .filter((file) => file.endsWith(".yaml"))
    .sort()
    .reverse()
    .map((file) => {
      const raw = loadYaml(path.join("saison", file), seasonSchema);
      return {
        id: file.replace(/\.yaml$/, ""),
        season: raw.season,
        league: pick(raw.league, locale),
        summary: pick(raw.summary, locale),
        standing: raw.standing,
        stats: raw.stats.map((stat) => ({
          label: pick(stat.label, locale),
          value: stat.value,
        })),
        table: [],
        matches: [],
        ranking: [],
        source: raw.bvv ? { url: raw.bvv.url, team: raw.bvv.team ?? teamName, player: raw.bvv.player ?? defaultPlayer } : undefined,
        fixtures: raw.fixtures
          .map((fixture): Fixture => {
            const own = fixture.home ? 0 : 1;
            const result = fixture.result?.split(":").map(Number) as [number, number] | undefined;
            return {
              date: fixture.date,
              teams: fixture.home ? [teamName, fixture.opponent] : [fixture.opponent, teamName],
              own,
              opponent: fixture.opponent,
              home: fixture.home,
              venue: fixture.venue,
              competition: pick(fixture.competition, locale),
              note: pick(fixture.note, locale),
              result,
              sets: fixture.sets?.split(" ") ?? [],
              outcome: result ? outcomeOf(own, result) : undefined,
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
});

// ---------------------------------------------------------------------------
// Eigene Spieltagsberichte: content/spieltage/<JJJJ-MM-TT>.de.mdx (+ .en.mdx)
// Optional – ohne Datei zeigt die Spieltagsseite einen automatisch aus den
// Verbandsdaten erzeugten Bericht.
// ---------------------------------------------------------------------------

const MATCHDAY_DIR = path.join(CONTENT_DIR, "spieltage");

const matchdayReportSchema = z.object({ title: z.string().optional(), description: z.string().optional() });

export const getMatchdayReport = cache((date: string, locale: Locale) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  if (!fs.existsSync(path.join(MATCHDAY_DIR, `${date}.de.mdx`))) return undefined;
  const { data, body, contentLocale, file } = readLocalizedMdx((l) => path.join(MATCHDAY_DIR, `${date}.${l}.mdx`), locale);
  const result = matchdayReportSchema.safeParse(data);
  if (!result.success) fail(file, result.error);
  return { ...result.data, body, contentLocale };
});

/**
 * Nächster Spieltag = alle Spiele ohne Ergebnis am Tag des ersten Spiels ohne
 * Ergebnis (im Volleyball spielt man oft zwei Spiele an einem Spieltag).
 */
export function nextMatchday(season: Season | undefined): Fixture[] {
  const first = season?.fixtures.find((fixture) => !fixture.result);
  if (!season || !first) return [];
  const day = first.date.slice(0, 10);
  return season.fixtures.filter((fixture) => !fixture.result && fixture.date.startsWith(day));
}

/** Letztes Ergebnis = letztes Spiel mit eingetragenem Ergebnis. */
export function lastResult(season: Season | undefined): Fixture | undefined {
  return season?.fixtures.findLast((fixture) => fixture.result);
}

/** Sätze aus Sicht der eigenen Mannschaft: [eigene Punkte, Punkte des Gegners] */
export function ownSets(fixture: Fixture): [number, number][] {
  return fixture.sets.map((set) => {
    const [first, second] = set.split(":").map(Number);
    return fixture.own === 0 ? [first, second] : [second, first];
  });
}
