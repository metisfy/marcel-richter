import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { getPage, getProjects, getSite, roleLine } from "@/lib/content";

/*
 * Open-Graph-Bilder (1200×630) für jede Seite und jedes Projekt, in beiden
 * Sprachen. Werden beim Build einmal erzeugt und dann statisch ausgeliefert.
 * URL: /og/<sprache>/<schlüssel>, z. B. /og/en/projekt-vereinsapp
 */

export const dynamic = "force-static";
export const dynamicParams = false;

const PAGE_KEYS = ["home", "ueber-mich", "projekte", "saison", "kontakt", "impressum", "datenschutz"] as const;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => [
    ...PAGE_KEYS.map((key) => ({ locale, key })),
    ...getProjects(locale).map((project) => ({ locale, key: `projekt-${project.slug}` })),
  ]);
}

async function textFor(locale: Locale, key: string): Promise<{ eyebrow: string; title: string; text: string; photo?: boolean } | null> {
  const site = getSite(locale);
  const nav = await getTranslations({ locale, namespace: "nav" });

  if (key === "home") return { eyebrow: roleLine(site), title: site.name, text: site.tagline, photo: true };
  if (key === "ueber-mich" || key === "impressum" || key === "datenschutz") {
    const page = getPage(key, locale);
    return { eyebrow: site.jobTitle, title: page.title, text: page.description, photo: key === "ueber-mich" };
  }
  if (key === "projekte") {
    const t = await getTranslations({ locale, namespace: "projects" });
    return { eyebrow: site.jobTitle, title: t("title"), text: t("description") };
  }
  if (key === "saison") {
    const t = await getTranslations({ locale, namespace: "season" });
    return { eyebrow: `${site.team.name} · ${site.team.sport}`, title: t("title"), text: t("description") };
  }
  if (key === "kontakt") {
    const t = await getTranslations({ locale, namespace: "contact" });
    return { eyebrow: site.jobTitle, title: t("title"), text: t("description") };
  }
  if (key.startsWith("projekt-")) {
    const project = getProjects(locale).find((p) => p.slug === key.slice("projekt-".length));
    if (project) return { eyebrow: nav("projects"), title: project.title, text: project.summary };
  }
  return null;
}

/** Kürzt an einer Wortgrenze: „… am Wochenende…“ statt „… Wochenende spie…“ */
function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

// Schriften liegen als statische TTF im Repo (Inter, JetBrains Mono – beide
// SIL Open Font License), denn Satori kann weder WOFF2 noch variable Schriften.
const FONT_DIR = path.join(process.cwd(), "src/app/og/fonts");
const fonts = Promise.all([
  readFile(path.join(FONT_DIR, "inter-700.ttf")),
  readFile(path.join(FONT_DIR, "inter-400.ttf")),
  readFile(path.join(FONT_DIR, "jetbrains-mono-400.ttf")),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });
  const content = await textFor(locale, key);
  if (!content) return new Response("Not found", { status: 404 });
  const site = getSite(locale);
  const [bold, regular, mono] = await fonts;
  // Porträt rechts unten (Startseite, Über mich) – als Data-URL, Satori lädt nichts nach.
  const photo = content.photo
    ? `data:image/jpeg;base64,${(await readFile(path.join(process.cwd(), "public", site.portrait))).toString("base64")}`
    : undefined;
  const titleSize = content.title.length > 30 ? 68 : content.title.length > 18 || photo ? 84 : 104;
  const nameParts = site.name.split(" ");
  const lastName = nameParts.length > 1 ? nameParts.pop() : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 76px",
          background: "linear-gradient(180deg, #eef3ff 0%, #ffffff 55%)",
          color: "#111111",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 700, letterSpacing: -0.5 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 13,
                background: "#4f7dff",
                color: "#ffffff",
                fontFamily: "JetBrains Mono",
                fontSize: 22,
              }}
            >
              {site.team.number ?? site.name[0]}
            </div>
            <div style={{ display: "flex" }}>
              {nameParts.join(" ")}
              {lastName ? <span style={{ color: "#3a63d9", marginLeft: 9 }}>{lastName}</span> : null}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 44,
              padding: "0 20px",
              borderRadius: 999,
              border: "1px solid #e7e9ee",
              background: "#ffffff",
              fontFamily: "JetBrains Mono",
              fontSize: 20,
              color: "#666666",
            }}
          >
            <div style={{ display: "flex", width: 10, height: 10, borderRadius: 999, background: "#2fa98c" }} />
            {content.eyebrow}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 26, flex: 1 }}>
            <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, lineHeight: 1.02, letterSpacing: -titleSize * 0.03 }}>
              {content.title}
            </div>
            <div style={{ display: "flex", fontSize: 30, color: "#666666", lineHeight: 1.45, maxWidth: photo ? 720 : 980 }}>
              {shorten(content.text, photo ? 110 : 130)}
            </div>
          </div>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori rendert nur <img>
            <img
              src={photo}
              alt=""
              width={240}
              height={300}
              style={{ borderRadius: 28, border: "1px solid #e7e9ee", objectFit: "cover" }}
            />
          ) : null}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Inter", data: bold, weight: 700, style: "normal" },
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "JetBrains Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
