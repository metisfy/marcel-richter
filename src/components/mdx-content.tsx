import Image from "next/image";

import { compileMDX } from "next-mdx-remote/rsc";
import type { ComponentProps } from "react";

import { ANALYTICS } from "@/lib/analytics";
import { websiteSettings } from "@/lib/website-settings";

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
 * Bausteine für die Datenschutzerklärung, die sich nach der Besucherstatistik
 * richten: eigene Statistik (Schalter im Admin-Bereich, src/lib/visits.ts)
 * und optional Umami (src/lib/analytics.ts). Ist beides aus, steht dort
 * „kein Tracking“ und Abschnitt 13 entfällt.
 *
 *   - <Tracking sprache="de" />
 *   <Besucherstatistik sprache="de" />
 */
function Tracking({ sprache = "de" }: { sprache?: "de" | "en" }) {
  const own = websiteSettings().statistics;
  if (!own && !ANALYTICS) {
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
      Es gibt <strong>keine Werbung</strong> und kein Tracking über Cookies. Seitenaufrufe zählen wir anonym und ohne Cookies auf
      unserem eigenen Server (Abschnitt 13).
    </>
  ) : (
    <>
      There is <strong>no advertising</strong> and no cookie-based tracking. We count page views anonymously and without cookies
      on our own server (section 13).
    </>
  );
}

function Besucherstatistik({ sprache = "de" }: { sprache?: "de" | "en" }) {
  const own = websiteSettings().statistics;
  if (!own && !ANALYTICS) return null;
  return sprache === "de" ? (
    <>
      <h2>13. Besucherstatistik</h2>
      {own ? (
        <>
          <p>
            Um zu sehen, welche Seiten wie oft aufgerufen werden, zählen wir Seitenaufrufe selbst – ohne Cookies und ohne Dienste
            Dritter. Ein kleines Skript meldet beim Aufruf einer Seite deren Adresse und, beim ersten Aufruf, die Seite, von der
            Sie kamen, an unseren eigenen Server. Erfasst werden der Tag, die aufgerufene Seite, die Domain der Herkunftsseite
            (z. B. google.com) und die Geräteklasse (Smartphone, Tablet, Computer), die der Server aus der Browserkennung
            ableitet. Gespeichert werden nur zusammengefasste Zahlen je Tag, für höchstens zwei Jahre.
          </p>
          <p>
            Um Besucher eines Tages nur einmal zu zählen, bildet der Server aus IP-Adresse, Browserkennung und einem täglich neuen
            Zufallswert eine Prüfsumme. Die IP-Adresse selbst wird nicht gespeichert, die Prüfsumme nach spätestens 48 Stunden
            gelöscht und der Zufallswert täglich verworfen – ein Bezug zu Ihrer Person lässt sich damit nicht herstellen. Sendet
            Ihr Browser „Do Not Track“ oder „Global Privacy Control“, wird nichts gezählt.
          </p>
        </>
      ) : null}
      {ANALYTICS ? (
        <p>
          Zusätzlich nutzen wir die Open-Source-Software Umami auf eigenem Server ({ANALYTICS.host}); sie setzt keine Cookies und
          speichert keine IP-Adressen.
        </p>
      ) : null}
      <p>
        Rechtsgrundlage ist unser berechtigtes Interesse an einer bedarfsgerechten Gestaltung der Website (Art. 6 Abs. 1 lit. f
        DSGVO). Sie können jederzeit widersprechen, z. B. indem Sie „Do Not Track“ oder „Global Privacy Control“ in Ihrem
        Browser aktivieren.
      </p>
    </>
  ) : (
    <>
      <h2>13. Visitor statistics</h2>
      {own ? (
        <>
          <p>
            To see which pages are visited and how often, we count page views ourselves – without cookies and without third-party
            services. A small script reports the address of the page you open and, on your first page view, the page you came from
            to our own server. We record the day, the page visited, the domain of the referring page (e.g. google.com) and the
            device class (smartphone, tablet, computer), which the server derives from the browser identifier. Only aggregated daily figures are stored, for at most two years.
          </p>
          <p>
            To count visitors only once per day, the server forms a checksum from the IP address, browser identifier and a random
            value that changes daily. The IP address itself is not stored, the checksum is deleted after 48 hours at the latest and
            the random value is discarded daily, so it cannot be linked to you. If your browser sends “Do Not Track” or “Global
            Privacy Control”, nothing is counted.
          </p>
        </>
      ) : null}
      {ANALYTICS ? (
        <p>
          In addition we use the open-source software Umami on our own server ({ANALYTICS.host}); it sets no cookies and stores
          no IP addresses.
        </p>
      ) : null}
      <p>
        The legal basis is our legitimate interest in designing the website to meet visitors&apos; needs (Art. 6 (1) (f) GDPR).
        You can object at any time, e.g. by enabling “Do Not Track” or “Global Privacy Control” in your browser.
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
