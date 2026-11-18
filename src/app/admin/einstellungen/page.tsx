import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/shell";
import { Badge, PageHead, SettingsTile } from "@/components/admin/ui";
import { adminPrefix, requireAdmin } from "@/lib/admin/guard";
import { dataDirPersistent } from "@/lib/admin/storage";
import { mailStatus } from "@/lib/contact";

export const metadata: Metadata = { title: "Einstellungen" };

/** Übersicht wie bei t-orga: jede Kachel führt zu einer Unterseite, mit Stand auf einen Blick. */
export default async function SettingsOverview() {
  const admin = await requireAdmin("/einstellungen");
  const prefix = await adminPrefix();
  const mail = await mailStatus();
  const persistent = dataDirPersistent();

  return (
    <AdminShell admin={admin}>
      <div className="mx-auto max-w-3xl">
        <PageHead title="Einstellungen" text="Mailversand, System und dein Zugang." />
        <div className="grid gap-4">
          <SettingsTile
            href={`${prefix}/einstellungen/mailversand`}
            icon="mail"
            title="Mailversand"
            text="SMTP-Zugang, damit Nachrichten aus dem Kontaktformular auch per Mail ankommen."
            status={
              mail.state === "umgebung" || mail.state === "admin" ? (
                <Badge tone="good">eingerichtet</Badge>
              ) : mail.state === "unlesbar" ? (
                <Badge tone="bad">Passwort neu eingeben</Badge>
              ) : (
                <Badge tone="warn">fehlt</Badge>
              )
            }
          />
          <SettingsTile
            href={`${prefix}/einstellungen/system`}
            icon="server"
            title="System"
            text="Datenbankverbindung, Ablage auf dem Volume und laufende Version."
            status={persistent === false ? <Badge tone="bad">Ablage ohne Volume</Badge> : <Badge tone="neutral">Info</Badge>}
          />
          <SettingsTile
            href={`${prefix}/profil`}
            icon="user"
            title="Mein Profil"
            text="Name, E-Mail, Passwort, Passkeys und Authenticator-App."
            status={admin.twoFactor ? <Badge tone="good">2FA aktiv</Badge> : <Badge tone="bad">ohne 2FA</Badge>}
          />
        </div>
      </div>
    </AdminShell>
  );
}
