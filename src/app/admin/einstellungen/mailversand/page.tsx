import type { Metadata } from "next";

import { removeMail, saveMail } from "@/app/admin/actions";
import { ActionButton, ActionForm, Checkbox, Field, SubmitButton } from "@/components/admin/forms";
import { AdminShell } from "@/components/admin/shell";
import { Badge, InfoList, PageHead, Panel, formatDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { storedMailSettings } from "@/lib/admin/mail-settings";
import { envMailConfig, envMailVariables, mailStatus } from "@/lib/contact";
import { getSite } from "@/lib/content";

export const metadata: Metadata = { title: "Mailversand" };

export default async function MailPage() {
  const admin = await requireAdmin("/einstellungen/mailversand");
  const site = getSite("de");
  const mail = await storedMailSettings().catch(() => null);
  const envMail = envMailConfig();
  const envVariables = envMailVariables();
  const status = await mailStatus();

  return (
    <AdminShell admin={admin}>
      <div className="mx-auto max-w-3xl">
        <PageHead
          title="Mailversand"
          text="Nachrichten aus dem Kontaktformular landen immer im Postfach hier – mit Mailversand zusätzlich in deinem E-Mail-Postfach."
        />

        <Panel title="Stand" text="So kommt der Mailversand gerade zustande.">
          <InfoList
            rows={[
              {
                label: "Wirksam",
                value:
                  status.state === "umgebung" ? (
                    <Badge tone="good">Server-Umgebung</Badge>
                  ) : status.state === "admin" ? (
                    <Badge tone="good">Einstellungen hier</Badge>
                  ) : status.state === "unlesbar" ? (
                    <Badge tone="bad">Passwort nicht lesbar</Badge>
                  ) : (
                    <Badge tone="warn">kein Mailversand</Badge>
                  ),
              },
              ...(status.state === "umgebung" || status.state === "admin" ? [{ label: "Empfänger", value: status.to }] : []),
              {
                label: "Server-Umgebung (.env)",
                value: envVariables.length ? envVariables.join(", ") : "keine SMTP-Variablen im Container",
              },
              { label: "Einstellungen hier", value: mail ? `${mail.host}:${mail.port}` : "nicht gespeichert" },
            ]}
          />
          {status.state === "unlesbar" ? (
            <p className="mt-4 rounded-xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss">
              Das gespeicherte Passwort wurde mit einem früheren App-Geheimnis verschlüsselt (Daten-Volume neu angelegt) und lässt sich
              nicht mehr lesen. Bitte unten das Passwort noch einmal eingeben und „Testen und speichern“.
            </p>
          ) : null}
          {envVariables.length > 0 && !envMail ? (
            <p className="mt-4 rounded-xl bg-loss-soft px-4 py-3 text-sm font-medium text-loss">
              In der Server-Umgebung fehlt etwas: Nötig sind mindestens SMTP_HOST und SMTP_FROM (oder SMTP_USER).
            </p>
          ) : null}
        </Panel>

        <div className="h-6" />

        {envMail ? (
          <Panel title="Über die Server-Umgebung eingerichtet" action={<Badge tone="good">aktiv</Badge>}>
            <p className="text-[15px]">
              <code className="font-mono">SMTP_HOST={envMail.host}</code>, Nachrichten gehen an {envMail.to}. Die Umgebung (.env auf dem Server) hat
              Vorrang vor den Einstellungen hier.
            </p>
          </Panel>
        ) : (
          <Panel
            title="SMTP-Zugang"
            text="Gespeichert wird erst nach einer erfolgreichen Testmail; das Passwort liegt verschlüsselt in der Datenbank."
            action={
              status.state === "admin" ? (
                <Badge tone="good">eingerichtet</Badge>
              ) : status.state === "unlesbar" ? (
                <Badge tone="bad">Passwort neu eingeben</Badge>
              ) : (
                <Badge tone="warn">nicht eingerichtet</Badge>
              )
            }
          >
            {mail ? <p className="mb-5 text-sm text-muted">Zuletzt geändert {formatDateTime(mail.changedAt)}.</p> : null}
            <ActionForm action={saveMail}>
              <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
                <Field label="Mailserver (SMTP)" name="host" defaultValue={mail?.host} placeholder="smtp.example.com" required />
                <Field label="Port" name="port" defaultValue={mail?.port ?? 587} inputMode="numeric" hint="587 oder 465" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Benutzer" name="user" defaultValue={mail?.user} autoComplete="off" />
                <Field label="Passwort" name="password" type="password" autoComplete="new-password" placeholder={mail?.passwordSet ? "unverändert" : undefined} />
              </div>
              {mail?.passwordSet ? <Checkbox label="Gespeichertes Passwort entfernen" name="clearPassword" /> : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Absender" name="from" type="email" defaultValue={mail?.from ?? mail?.user} placeholder="website@example.com" required />
                <Field label="Empfänger" name="to" type="email" defaultValue={mail?.to} placeholder={site.email} hint={`Leer = ${site.email}`} />
              </div>
              <div>
                <SubmitButton pendingText="Sende Testmail …">Testen und speichern</SubmitButton>
              </div>
            </ActionForm>
            {mail ? (
              <div className="mt-6 border-t border-line pt-5">
                <ActionButton action={removeMail} confirm="Mailversand entfernen? Nachrichten landen dann nur noch im Postfach." variant="danger">
                  Mailversand entfernen
                </ActionButton>
              </div>
            ) : null}
          </Panel>
        )}
      </div>
    </AdminShell>
  );
}
