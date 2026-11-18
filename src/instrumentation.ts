/**
 * Läuft einmal beim Start des Servers.
 *
 * - Solange der Admin-Bereich nicht eingerichtet ist, steht der
 *   Einrichtungsschlüssel im Protokoll (`docker logs marcel-richter`);
 *   start.sh zeigt ihn zusätzlich an.
 * - Besucherstatistik: gesammelte Aufrufe alle 15 Sekunden in die Datenbank
 *   schreiben (src/lib/visits.ts, src/lib/admin/statistics.ts).
 * - Weichen Schalter im Admin-Bereich vom Standard ab (versteckte Projekte,
 *   Suchmaschinen aus), alle Seiten einmal neu erzeugen – die Seiten aus dem
 *   Build kennen die Schalter nicht.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Beim Build (Prerender) nichts anlegen und nichts starten
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { appSecret, setupKey, wizardDone } = await import("@/lib/admin/storage");
  appSecret();
  if (!wizardDone()) {
    const { adminUrl } = await import("@/lib/admin/hosts");
    console.log("");
    console.log("→ ERSTEINRICHTUNG: Der Admin-Bereich ist noch nicht eingerichtet.");
    console.log(`  Im Browser öffnen:      ${adminUrl() ?? "http://<server>:3100/admin"}  (oder http://<server>:3100/admin)`);
    console.log(`  Einrichtungsschlüssel:  ${setupKey()}`);
    console.log("");
  }

  const shared = globalThis as unknown as { __visitFlush?: NodeJS.Timeout };
  if (!shared.__visitFlush) {
    const { flushVisits } = await import("@/lib/admin/statistics");
    shared.__visitFlush = setInterval(() => {
      flushVisits().catch((error) => console.error("[statistik] Schreiben fehlgeschlagen:", error instanceof Error ? error.message : error));
    }, 15_000);
    shared.__visitFlush.unref();
  }

  const { settingsDiffer, websiteSettings } = await import("@/lib/website-settings");
  if (settingsDiffer(websiteSettings())) {
    const { internalToken } = await import("@/lib/admin/internal");
    const port = process.env.PORT || "3000";
    setTimeout(() => {
      fetch(`http://127.0.0.1:${port}/api/intern/neu-erzeugen`, { method: "POST", headers: { "x-intern": internalToken() } }).catch(() => {});
    }, 5_000).unref();
  }
}
