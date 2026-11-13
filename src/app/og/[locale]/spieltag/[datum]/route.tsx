import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";

import { initials } from "@/components/brand";
import { routing } from "@/i18n/routing";
import { getMatchdayReport, getSite } from "@/lib/content";
import { formatDate, formatTime } from "@/lib/format";
import { getMatchday, matchdayDates, matchdayReport } from "@/lib/matchday";
import { loadSeasons } from "@/lib/season";

/*
 * Vorschaubild (1200×630) je Spieltag: nach dem Spieltag mit Ergebnissen,
 * vorher mit Gegnern und Uhrzeit. Alle fünf Minuten neu, wie die Seite.
 * URL: /og/<sprache>/spieltag/<JJJJ-MM-TT>
 */

export const dynamic = "force-static";
export const revalidate = 300;

export async function generateStaticParams() {
  const params: { locale: string; datum: string }[] = [];
  for (const locale of routing.locales) {
    for (const datum of new Set((await loadSeasons(locale)).flatMap(matchdayDates))) params.push({ locale, datum });
  }
  return params;
}

const FONT_DIR = path.join(process.cwd(), "src/app/og/fonts");
const fonts = Promise.all([
  readFile(path.join(FONT_DIR, "inter-700.ttf")),
  readFile(path.join(FONT_DIR, "inter-400.ttf")),
  readFile(path.join(FONT_DIR, "jetbrains-mono-400.ttf")),
]);

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; datum: string }> }) {
  const { locale, datum } = await params;
  if (!hasLocale(routing.locales, locale) || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return new Response("Not found", { status: 404 });

  const season = (await loadSeasons(locale)).find((entry) => matchdayDates(entry).includes(datum));
  const day = season ? getMatchday(season, datum) : undefined;
  if (!season || !day) return new Response("Not found", { status: 404 });

  const site = getSite(locale);
  const de = locale === "de";
  const title = getMatchdayReport(datum, locale)?.title ?? matchdayReport(day, season, locale).title;
  const time = formatTime(day.fixtures[0].date, locale);
  const eyebrow = `${de ? (day.played ? "Spieltag" : "Vorschau") : day.played ? "Matchday" : "Preview"} · ${formatDate(datum, locale, { weekday: true, time: false })}${!day.played && time ? ` · ${time}` : ""}`;
  const [bold, regular, mono] = await fonts;
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
          padding: "56px 76px",
          background: "linear-gradient(180deg, #eef3ff 0%, #ffffff 55%)",
          color: "#111111",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }}>
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
                fontSize: 20,
              }}
            >
              {site.team.number ?? initials(site.name)}
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
              fontSize: 19,
              color: "#666666",
            }}
          >
            <div style={{ display: "flex", width: 10, height: 10, borderRadius: 999, background: "#2fa98c" }} />
            {eyebrow}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: title.length > 26 ? 64 : 80, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.4 }}>{title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {day.fixtures.map((fixture) => {
              const won = fixture.outcome === "win";
              return (
                <div
                  key={`${fixture.number}-${fixture.opponent}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 24,
                    padding: "18px 26px",
                    borderRadius: 20,
                    border: "1px solid #e7e9ee",
                    background: "#ffffff",
                    fontSize: 30,
                  }}
                >
                  <div style={{ display: "flex", gap: 14 }}>
                    <span style={{ fontWeight: fixture.own === 0 ? 700 : 400 }}>{fixture.teams[0]}</span>
                    <span style={{ color: "#999999" }}>–</span>
                    <span style={{ fontWeight: fixture.own === 1 ? 700 : 400 }}>{fixture.teams[1]}</span>
                  </div>
                  {fixture.result ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span
                        style={{
                          display: "flex",
                          padding: "6px 16px",
                          borderRadius: 999,
                          fontFamily: "JetBrains Mono",
                          fontSize: 20,
                          background: won ? "#e3f5ee" : "#fdecec",
                          color: won ? "#12704f" : "#b42318",
                        }}
                      >
                        {won ? (de ? "Sieg" : "Win") : de ? "Niederlage" : "Loss"}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 38 }}>{fixture.result.join(":")}</span>
                    </div>
                  ) : (
                    <span style={{ fontFamily: "JetBrains Mono", fontSize: 22, color: "#666666" }}>{formatTime(fixture.date, locale) ?? ""}</span>
                  )}
                </div>
              );
            })}
          </div>
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
