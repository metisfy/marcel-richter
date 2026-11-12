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

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum im Format "JJJJ-MM-TT" angeben');

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
  location: localized.optional(),
  email: z.email(),
  portrait: imageSrc,
  portraitAlt: localized,
  socials: z.array(link).default([]),
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
    location: pick(raw.location, locale),
    portraitAlt: pick(raw.portraitAlt, locale),
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

// ---------------------------------------------------------------------------
// Projekte: content/projekte/<slug>/de.mdx (+ en.mdx)
// ---------------------------------------------------------------------------

const PROJECTS_DIR = path.join(CONTENT_DIR, "projekte");

const projectSchema = z.object({
  title: z.string(),
  summary: z.string(),
  date: isoDate,
  cover: imageSrc,
  coverAlt: z.string(),
  role: z.string().optional(),
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
    .sort((a, b) => b.date.localeCompare(a.date)),
);

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
// Fotos: content/fotos.yaml
// ---------------------------------------------------------------------------

const photosSchema = z.object({
  albums: z.array(
    z.object({
      slug,
      title: localized,
      description: localized.optional(),
      date: isoDate,
      photos: z
        .array(
          z.object({
            src: imageSrc,
            alt: localized,
            caption: localized.optional(),
          }),
        )
        .min(1, "Ein Album braucht mindestens ein Foto"),
    }),
  ),
});

export type Photo = { src: string; alt: string; caption?: string };
export type Album = {
  slug: string;
  title: string;
  description?: string;
  date: string;
  photos: Photo[];
};

export const getAlbums = cache((locale: Locale): Album[] =>
  loadYaml("fotos.yaml", photosSchema)
    .albums.map((album) => ({
      slug: album.slug,
      title: pick(album.title, locale),
      description: pick(album.description, locale),
      date: album.date,
      photos: album.photos.map((photo) => ({
        src: photo.src,
        alt: pick(photo.alt, locale),
        caption: pick(photo.caption, locale),
      })),
    }))
    .sort((a, b) => b.date.localeCompare(a.date)),
);

// ---------------------------------------------------------------------------
// Saisons: content/saison/<JJJJ-JJ>.yaml — die neueste Datei ist die aktuelle
// ---------------------------------------------------------------------------

const SEASON_DIR = path.join(CONTENT_DIR, "saison");

const seasonSchema = z.object({
  season: z.string(),
  league: localized,
  summary: localized.optional(),
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

export type Fixture = {
  /** "JJJJ-MM-TT" oder "JJJJ-MM-TT HH:MM", deutsche Ortszeit */
  date: string;
  opponent: string;
  home: boolean;
  venue?: string;
  competition?: string;
  note?: string;
  /** Endstand in Sätzen, aus Sicht der Heimmannschaft */
  result?: { home: number; away: number };
  /** Einzelne Sätze, aus Sicht der Heimmannschaft, z. B. ["25:21", "22:25"] */
  sets: string[];
  outcome?: Outcome;
};

export type Season = {
  id: string;
  season: string;
  league: string;
  summary?: string;
  standing?: { position: number; teams: number; points?: number };
  stats: { label: string; value: string | number }[];
  fixtures: Fixture[];
};

function outcomeOf(home: boolean, result: { home: number; away: number }): Outcome {
  const own = home ? result.home : result.away;
  const other = home ? result.away : result.home;
  return own > other ? "win" : "loss";
}

export const getSeasons = cache((locale: Locale): Season[] =>
  fs
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
        fixtures: raw.fixtures
          .map((fixture): Fixture => {
            const [home, away] = fixture.result?.split(":").map(Number) ?? [];
            const result =
              fixture.result !== undefined ? { home, away } : undefined;
            return {
              date: fixture.date,
              opponent: fixture.opponent,
              home: fixture.home,
              venue: fixture.venue,
              competition: pick(fixture.competition, locale),
              note: pick(fixture.note, locale),
              result,
              sets: fixture.sets?.split(" ") ?? [],
              outcome: result ? outcomeOf(fixture.home, result) : undefined,
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }),
);

export function currentSeason(locale: Locale): Season | undefined {
  return getSeasons(locale)[0];
}

/** Nächstes Spiel = erstes Spiel ohne eingetragenes Ergebnis. */
export function nextFixture(season: Season | undefined): Fixture | undefined {
  return season?.fixtures.find((fixture) => !fixture.result);
}

/** Letztes Ergebnis = letztes Spiel mit eingetragenem Ergebnis. */
export function lastResult(season: Season | undefined): Fixture | undefined {
  return season?.fixtures.findLast((fixture) => fixture.result);
}
