import "./globals.css";

import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";

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
    <html lang="de" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <main className="container-page flex flex-1 flex-col items-center justify-center py-24 text-center">
          <p className="eyebrow mb-3">404</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Seite nicht gefunden</h1>
          <p className="mt-3 max-w-md text-muted">
            Diese Seite gibt es nicht (mehr). Vielleicht hilft dir die Startseite weiter.
          </p>
          <div lang="en" className="mt-8 border-t border-border pt-8">
            <h2 className="text-2xl font-semibold tracking-tight">Page not found</h2>
            <p className="mt-2 max-w-md text-muted">This page doesn&apos;t exist (anymore).</p>
          </div>
          <p className="mt-10 flex flex-wrap justify-center gap-3">
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
