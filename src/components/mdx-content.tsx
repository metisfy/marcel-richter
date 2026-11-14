import Image from "next/image";

import { ANALYTICS } from "@/lib/analytics";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ComponentProps } from "react";

/**
 * Komponenten, die in MDX-Dateien zur Verfügung stehen. Beispiel:
 *
 *   <Figure src="/images/projekte/x.jpg" alt="…" caption="…" />
 *
 * Für optimierte, responsive Bilder <Figure> statt ![…](…) verwenden.
 */
function Figure({
  src,
  alt,
  caption,
  ratio = "16/9",
}: {
  src: string;
  alt: string;
  caption?: string;
  ratio?: string;
}) {
  return (
    <figure>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface" style={{ aspectRatio: ratio }}>
        <Image src={src} alt={alt} fill sizes="(min-width: 768px) 680px, 100vw" className="object-cover" />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function MdxImage({ src, alt }: ComponentProps<"img">) {
  // Markdown-Bilder stehen innerhalb von <p>; ein <figure> wäre dort
  // ungültiges HTML. Deshalb hier ein schlichtes, lazy geladenes <img>.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" decoding="async" />;
}

/*
 * Bausteine für die Datenschutzerklärung, die sich nach der optionalen
 * Besucherstatistik richten (src/lib/analytics.ts). Ist sie aus (Standard),
 * steht dort genau der bisherige Text und Abschnitt 13 entfällt.
 *
 *   - <Tracking sprache="de" />
 *   <Besucherstatistik sprache="de" />
 */
function Tracking({ sprache = "de" }: { sprache?: "de" | "en" }) {
  if (!ANALYTICS) {
    return sprache === "de" ? (
      <>
        Es gibt <strong>kein Tracking</strong>, keine Analyse-Werkzeuge und keine Werbung.
      </>
    ) : (
      <>
        There is <strong>no tracking</strong>, no analytics and no advertising.
      </>
    );
  }
  return sprache === "de" ? (
    <>
      Es gibt <strong>keine Werbung</strong> und kein Tracking über Cookies. Für eine anonyme Besucherstatistik ohne Cookies
      nutzen wir Umami auf eigenem Server ({ANALYTICS.host}, Abschnitt 13).
    </>
  ) : (
    <>
      There is <strong>no advertising</strong> and no cookie-based tracking. For anonymous visitor statistics without cookies we
      use Umami on our own server ({ANALYTICS.host}, section 13).
    </>
  );
}

function Besucherstatistik({ sprache = "de" }: { sprache?: "de" | "en" }) {
  if (!ANALYTICS) return null;
  return sprache === "de" ? (
    <>
      <h2>13. Besucherstatistik (Umami)</h2>
      <p>
        Um zu sehen, welche Seiten wie oft aufgerufen werden, nutzen wir die Open-Source-Software Umami, die wir selbst
        betreiben ({ANALYTICS.host}). Umami setzt keine Cookies und speichert keine IP-Adressen. Erfasst werden nur
        aufgerufene Seite, Herkunftsseite, Browser, Betriebssystem, Gerätetyp, Bildschirmgröße, Sprache und Land, ohne
        Bezug zu Ihrer Person. Sendet Ihr Browser „Do Not Track“, wird nichts erfasst. Die Daten verlassen unseren Server
        nicht.
      </p>
      <p>
        Rechtsgrundlage ist unser berechtigtes Interesse an einer bedarfsgerechten Gestaltung der Website (Art. 6 Abs. 1
        lit. f DSGVO). Sie können jederzeit widersprechen, z. B. indem Sie „Do Not Track“ in Ihrem Browser aktivieren.
      </p>
    </>
  ) : (
    <>
      <h2>13. Visitor statistics (Umami)</h2>
      <p>
        To see which pages are visited and how often, we use the open-source software Umami, which we host ourselves (
        {ANALYTICS.host}). Umami sets no cookies and stores no IP addresses. Only the page visited, referring page,
        browser, operating system, device type, screen size, language and country are recorded, without any link to you
        as a person. If your browser sends “Do Not Track”, nothing is recorded. The data never leaves our server.
      </p>
      <p>
        The legal basis is our legitimate interest in designing the website to meet visitors&apos; needs (Art. 6 (1) (f)
        GDPR). You can object at any time, e.g. by enabling “Do Not Track” in your browser.
      </p>
    </>
  );
}

const components = { Figure, img: MdxImage, Tracking, Besucherstatistik };

export async function MdxContent({ source, lang }: { source: string; lang?: string }) {
  const { content } = await compileMDX({
    source,
    components,
    options: { parseFrontmatter: false },
  });
  return (
    <div className="prose" lang={lang}>
      {content}
    </div>
  );
}
