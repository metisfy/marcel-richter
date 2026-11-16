import "../globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { fontVariables } from "@/lib/fonts";
import { themeInitScript } from "@/lib/theme-script";

/*
 * Eigenes Wurzel-Layout für den Admin-Bereich (deutsch, ohne Kopf- und
 * Fußzeile der Website, nie indexiert). Erreichbar unter admin.<domain>
 * oder <server>:3100/admin – siehe src/lib/admin/hosts.ts.
 *
 * Schützt NICHTS: Jede Seite und jede Aktion prüft die Anmeldung selbst
 * (src/lib/admin/guard.ts).
 */

// Nie vorab beim Build rendern: Zustand (Einrichtung, Anmeldung) gibt es erst zur Laufzeit
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e11" },
  ],
  colorScheme: "light dark",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
