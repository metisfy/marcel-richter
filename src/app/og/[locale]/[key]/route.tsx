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

  if (key === "home") return { eyebrow: `${site.jobTitle} · ${site.team.sport}`, title: site.name, text: site.tagline };
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

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; key: string }> }) {
  const { locale, key } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response("Not found", { status: 404 });
  const content = await textFor(locale, key);
  if (!content) return new Response("Not found", { status: 404 });
  const initials = getSite(locale)
    .name.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0c0a09 0%, #1c1917 55%, #134e4a 100%)",
          color: "#fafaf9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#2dd4bf",
              color: "#042f2e",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {initials}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#5eead4", letterSpacing: 1 }}>{content.eyebrow}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: content.title.length > 32 ? 64 : 84, fontWeight: 700, lineHeight: 1.05 }}>
            {content.title}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#d6d3d1", lineHeight: 1.35, maxWidth: 960 }}>
            {content.text.length > 140 ? `${content.text.slice(0, 137)}…` : content.text}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
