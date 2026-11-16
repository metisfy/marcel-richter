/**
 * Läuft einmal beim Start des Servers. Solange der Admin-Bereich nicht
 * eingerichtet ist, steht der Einrichtungsschlüssel im Protokoll
 * (`docker logs marcel-richter`); start.sh zeigt ihn zusätzlich an.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Beim Build (Prerender) nichts anlegen
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { appSecret, setupKey, wizardDone } = await import("@/lib/admin/storage");
  appSecret();
  if (wizardDone()) return;
  const { adminUrl } = await import("@/lib/admin/hosts");
  console.log("");
  console.log("→ ERSTEINRICHTUNG: Der Admin-Bereich ist noch nicht eingerichtet.");
  console.log(`  Im Browser öffnen:      ${adminUrl() ?? "http://<server>:3100/admin"}`);
  console.log(`  Einrichtungsschlüssel:  ${setupKey()}`);
  console.log("");
}
