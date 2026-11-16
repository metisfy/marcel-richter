import type { Metadata } from "next";

import { removeMail, saveMail } from "@/app/admin/actions";
import { ActionButton, ActionForm, Checkbox, Field, SubmitButton } from "@/components/admin/forms";
import { AdminShell } from "@/components/admin/shell";
import { Badge, PageHead, Panel, formatDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { storedMailSettings } from "@/lib/admin/mail-settings";
import { envMailConfig } from "@/lib/contact";
import { getSite } from "@/lib/content";

export const metadata: Metadata = { title: "Mailversand" };

export default async function MailPage() {
  const admin = await requireAdmin("/einstellungen/mailversand");
  const site = getSite("de");
  const mail = await storedMailSettings().catch(() => null);
  const envMail = envMailConfig();

  return (
    <AdminShell admin={admin}>
      <div className="mx-auto max-w-3xl">
        <PageHead
          title="Mailversand"
          text="Nachrichten aus dem Kontaktformular landen immer im Postfach hier – mit Mailversand zusätzlich in deinem E-Mail-Postfach."
        />

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
            action={mail ? <Badge tone="good">eingerichtet</Badge> : <Badge tone="warn">nicht eingerichtet</Badge>}
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
