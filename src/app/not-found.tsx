import "./globals.css";

import type { Metadata } from "next";

import { archivo } from "@/lib/fonts";
import { themeInitScript } from "@/lib/theme-script";

/*
 * 404 für alle Pfade, zu denen es keine Route gibt (z. B. /gibtsnicht oder
 * /en/whatever). Wird beim Build statisch erzeugt und serverseitig
 * ausgeliefert – deshalb zweisprachig, die Sprache ist hier nicht bekannt.
 *
 * Ruft eine Seite selbst notFound() auf (unbekannter Projekt-Slug), greift
 * stattdessen [locale]/not-found.tsx mit Kopf- und Fußzeile.
 */

export const metadata: Metadata = {
  title: "404 – Seite nicht gefunden / Page not found",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="de" className={archivo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <main className="container-page flex flex-1 flex-col justify-center py-20">
          <p aria-hidden="true" className="display text-[clamp(6rem,22vw,14rem)] text-accent">
            404
          </p>
          <h1 className="display mt-4 text-5xl">Seite nicht gefunden</h1>
          <p className="mt-3 max-w-md text-muted">Diese Seite gibt es nicht oder nicht mehr.</p>
          <div lang="en" className="mt-8 max-w-md border-t border-border pt-6">
            <h2 className="condensed text-2xl">Page not found</h2>
            <p className="mt-1 text-muted">This page doesn&apos;t exist, or no longer exists.</p>
          </div>
          <p className="mt-10 flex flex-wrap gap-3">
            {/* Bewusst <a>: Diese Seite liegt außerhalb des Sprach-Layouts. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="btn btn-primary">
              Zur Startseite
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/en" lang="en" className="btn btn-secondary">
              Home (English)
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
