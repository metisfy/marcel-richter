import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { getPage, getProjects, getSite } from "@/lib/content";

/*
 * Open-Graph-Bilder (1200×630) für jede Seite und jedes Projekt, in beiden
 * Sprachen. Werden beim Build einmal erzeugt und dann statisch ausgeliefert.
 * URL: /og/<sprache>/<schlüssel>, z. B. /og/en/projekt-vereinsapp
 */

export const dynamic = "force-static";
export const dynamicParams = false;

const PAGE_KEYS = ["home", "ueber-mich", "projekte", "fotos", "saison", "kontakt", "impressum", "datenschutz"] as const;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => [
    ...PAGE_KEYS.map((key) => ({ locale, key })),
    ...getProjects(locale).map((project) => ({ locale, key: `projekt-${project.slug}` })),
  ]);
}

async function textFor(locale: Locale, key: string): Promise<{ eyebrow: string; title: string; text: string } | null> {
  const site = getSite(locale);
  const nav = await getTranslations({ locale, namespace: "nav" });

  if (key === "home") return { eyebrow: site.jobTitle, title: site.name, text: site.tagline };
  if (key === "ueber-mich" || key === "impressum" || key === "datenschutz") {
    const page = getPage(key, locale);
    return { eyebrow: site.name, title: page.title, text: page.description };
  }
  if (key === "projekte") {
    const t = await getTranslations({ locale, namespace: "projects" });
    return { eyebrow: site.name, title: t("title"), text: t("description") };
  }
  if (key === "fotos") {
    const t = await getTranslations({ locale, namespace: "photos" });
    return { eyebrow: site.name, title: t("title"), text: t("description") };
  }
  if (key === "saison") {
    const t = await getTranslations({ locale, namespace: "season" });
    return { eyebrow: `${site.team.name} · ${site.team.sport}`, title: t("title"), text: t("description") };
  }
  if (key === "kontakt") {
    const t = await getTranslations({ locale, namespace: "contact" });
    return { eyebrow: site.name, title: t("title"), text: t("description") };
  }
  if (key.startsWith("projekt-")) {
    const project = getProjects(locale).find((p) => p.slug === key.slice("projekt-".length));
    if (project) return { eyebrow: `${site.name} · ${nav("projects")}`, title: project.title, text: project.summary };
  }
  return null;
}

// Schriften liegen als statische TTF im Repo (Archivo, SIL Open Font License),
// denn Satori kann weder WOFF2 noch variable Schriften lesen.
const FONT_DIR = path.join(process.cwd(), "src/app/og/fonts");
const fonts = Promise.all([
  readFile(path.join(FONT_DIR, "archivo-condensed-800.ttf")),
  readFile(path.join(FONT_DIR, "archivo-500.ttf")),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });
  const content = await textFor(locale, key);
  if (!content) return new Response("Not found", { status: 404 });
  const site = getSite(locale);
  const [condensed, regular] = await fonts;
  const titleSize = content.title.length > 28 ? 92 : content.title.length > 16 ? 120 : 150;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#16181d",
          color: "#f3f1eb",
          fontFamily: "Archivo",
          borderBottom: "24px solid #ff6b2c",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {site.team.number !== undefined ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 64,
                height: 64,
                padding: "0 10px",
                background: "#ff6b2c",
                color: "#16181d",
                fontFamily: "Archivo Condensed",
                fontSize: 48,
              }}
            >
              {site.team.number}
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 28, color: "#a7abb3" }}>{content.eyebrow}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Archivo Condensed",
              fontSize: titleSize,
              lineHeight: 0.9,
              textTransform: "uppercase",
            }}
          >
            {content.title}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#d9d6ce", lineHeight: 1.35, maxWidth: 980 }}>
            {content.text.length > 130 ? `${content.text.slice(0, 127)}…` : content.text}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Archivo Condensed", data: condensed, weight: 800, style: "normal" },
        { name: "Archivo", data: regular, weight: 500, style: "normal" },
      ],
    },
  );
}
