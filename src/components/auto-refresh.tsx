"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/*
 * Hält offene Seiten aktuell, ohne neu zu laden. Die Seite kennt die Kennung
 * ihres Datenstands (`version`, src/lib/season.ts → seasonsVersion). Jede
 * Minute (nur im sichtbaren Tab) und beim Zurückkehren in den Tab fragt der
 * Browser /api/stand – ein paar Bytes. Nur wenn sich der Stand geändert hat
 * (neues Ergebnis, Tabelle, neuer Tag, neues Deployment), holt er die Seite
 * neu (router.refresh); Scrollposition und aufgeklappte Elemente bleiben.
 * Liefert der Server noch die alte Fassung (er baut sie gerade neu), klappt
 * es beim nächsten Durchgang.
 */

const INTERVAL_MS = 60_000;

export function AutoRefresh({ version, locale }: { version: string; locale: string }) {
  const router = useRouter();
  useEffect(() => {
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch(`/api/stand?sprache=${locale}`, { cache: "no-store" });
        if (response.ok) {
          const latest = ((await response.json()) as { version?: string }).version;
          if (latest && latest !== version) router.refresh();
        }
      } catch {
        // offline – beim nächsten Mal
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(check, INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, [router, version, locale]);
  return null;
}
