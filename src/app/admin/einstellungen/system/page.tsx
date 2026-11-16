import type { Metadata } from "next";

import { checkDatabase } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/admin/forms";
import { AdminShell } from "@/components/admin/shell";
import { Badge, InfoList, PageHead, Panel, formatDateTime } from "@/components/admin/ui";
import { connectionSummary } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { adminUrl } from "@/lib/admin/hosts";
import { DATA_DIR, dataDirPersistent } from "@/lib/admin/storage";
import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";

export const metadata: Metadata = { title: "System" };

/** Startzeit des Serverprozesses (einmal beim Laden des Moduls bestimmt) */
const PROCESS_STARTED = new Date(Date.now() - process.uptime() * 1000);

export default async function SystemPage() {
  const admin = await requireAdmin("/einstellungen/system");
  const connection = connectionSummary();
  const persistent = dataDirPersistent();

  return (
    <AdminShell admin={admin}>
      <div className="mx-auto max-w-3xl">
        <PageHead title="System" text="Nur lesend – geändert wird über start.sh auf dem Server." />
        <div className="grid gap-6">
          <Panel title="Datenbank" text="MongoDB, extern – im Einrichtungsassistenten verbunden." action={<Badge tone="good">verbunden</Badge>}>
            {connection ? (
              <InfoList
                rows={[
                  { label: "Server", value: <span className="font-mono text-[14px]">{connection.server}</span> },
                  { label: "Datenbank", value: <span className="font-mono text-[14px]">{connection.database}</span> },
                  { label: "Benutzer", value: <span className="font-mono text-[14px]">{connection.user || "–"}</span> },
                  { label: "TLS", value: connection.tls ? "ja" : "nein" },
                  { label: "Eingerichtet", value: formatDateTime(connection.changedAt) },
                ]}
              />
            ) : null}
            <ActionForm action={checkDatabase} className="mt-5 grid gap-4">
              <div>
                <SubmitButton variant="ghost" small pendingText="Prüfe …">
                  Verbindung prüfen
                </SubmitButton>
              </div>
            </ActionForm>
          </Panel>

          <Panel
            title="Ablage"
            text="App-Geheimnis und Datenbankverbindung auf dem Volume marcel-richter-daten."
            action={
              persistent === false ? <Badge tone="bad">kein Volume</Badge> : persistent ? <Badge tone="good">Volume</Badge> : <Badge tone="neutral">lokal</Badge>
            }
          >
            <InfoList rows={[{ label: "Ordner", value: <span className="font-mono text-[14px]">{DATA_DIR}</span> }]} />
            {persistent === false ? (
              <p className="mt-4 rounded-xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss">
                Die Ablage liegt nicht auf einem Volume – beim nächsten Deployment wäre die Einrichtung weg. Aktuelle start.sh holen und ausführen.
              </p>
            ) : null}
          </Panel>

          <Panel title="Anwendung">
            <InfoList
              rows={[
                { label: "Version", value: <span className="font-mono text-[14px]">{process.env.GIT_SHA ?? "dev"}</span> },
                { label: "Läuft seit", value: formatDateTime(PROCESS_STARTED) },
                { label: "Node.js", value: process.version },
                { label: "Website", value: SITE_URL_CONFIGURED ? SITE_URL : <Badge tone="warn">ohne Domain</Badge> },
                { label: "Admin-Adresse", value: adminUrl() ?? "http://<server>:3100/admin" },
              ]}
            />
          </Panel>

          <Panel title="Neu einrichten" text="Andere Datenbank? Auf dem Server ausführen – danach zeigt der Bereich wieder den Assistenten.">
            <pre className="overflow-x-auto rounded-xl bg-surface p-4 font-mono text-sm">./start.sh --einrichtung-zuruecksetzen</pre>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
