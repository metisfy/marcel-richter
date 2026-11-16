import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  checkDatabase,
  confirmTwoFactor,
  logoutEverywhere,
  removeMail,
  renewBackupCodes,
  saveMail,
  savePassword,
  saveProfile,
  startTwoFactor,
  turnOffTwoFactor,
} from "@/app/admin/actions";
import { ActionButton, ActionForm, Checkbox, Field, SubmitButton } from "@/components/admin/forms";
import { AdminShell } from "@/components/admin/shell";
import { totpSecretOf } from "@/lib/admin/accounts";
import { connectionSummary } from "@/lib/admin/db";
import { requireAdmin } from "@/lib/admin/guard";
import { storedMailSettings } from "@/lib/admin/mail-settings";
import { otpauthUrl, qrSvg, readableSecret } from "@/lib/admin/totp";
import { envMailConfig } from "@/lib/contact";
import { getSite } from "@/lib/content";

export const metadata: Metadata = { title: "Einstellungen" };

const date = (value?: Date | string) =>
  value ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value)) : "–";

export default async function SettingsPage() {
  const admin = await requireAdmin("/einstellungen");
  const site = getSite("de");
  const [totp, mail] = await Promise.all([totpSecretOf(admin.id).catch(() => null), storedMailSettings().catch(() => null)]);
  const envMail = envMailConfig();
  const connection = connectionSummary();

  return (
    <AdminShell admin={admin} title="Einstellungen">
      <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:gap-10">
        <nav aria-label="Abschnitte" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-[14.5px]">
            {[
              ["konto", "Konto"],
              ["passwort", "Passwort"],
              ["zwei-faktor", "Zweiter Faktor"],
              ["mailversand", "Mailversand"],
              ["datenbank", "Datenbank"],
              ["sitzungen", "Sitzungen"],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-lg px-3 py-2 text-muted hover:bg-bg hover:text-fg">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-5">
          <Section id="konto" title="Konto" lead="Name und E-Mail-Adresse für die Anmeldung.">
            <ActionForm action={saveProfile}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" name="name" defaultValue={admin.name} autoComplete="name" required />
                <Field label="E-Mail-Adresse" name="email" type="email" defaultValue={admin.email} autoComplete="username" required />
              </div>
              <div>
                <SubmitButton>Speichern</SubmitButton>
              </div>
            </ActionForm>
          </Section>

          <Section id="passwort" title="Passwort" lead="Nach dem Wechsel sind alle anderen Geräte abgemeldet.">
            <ActionForm action={savePassword} resetOnSuccess>
              <Field label="Bisheriges Passwort" name="current" type="password" autoComplete="current-password" required />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Neues Passwort"
                  name="next"
                  type="password"
                  autoComplete="new-password"
                  hint="Mindestens 12 Zeichen, Groß- und Kleinbuchstaben, eine Ziffer."
                  required
                />
                <Field label="Neues Passwort wiederholen" name="repeat" type="password" autoComplete="new-password" required />
              </div>
              <div>
                <SubmitButton>Passwort ändern</SubmitButton>
              </div>
            </ActionForm>
          </Section>

          <Section
            id="zwei-faktor"
            title="Zweiter Faktor"
            lead="Zusätzlich zum Passwort ein Code aus einer Authenticator-App (z. B. iPhone-Passwörter, Google Authenticator, 1Password)."
          >
            {admin.twoFactor ? (
              <div className="grid gap-6">
                <p className="rounded-xl bg-win-soft px-4 py-3 font-medium text-win">
                  Aktiv seit {date(admin.twoFactorSince)} · {admin.backupCodesLeft} Ersatzcodes übrig
                </p>
                <div className="grid gap-6 md:grid-cols-2">
                  <ActionForm action={renewBackupCodes} resetOnSuccess>
                    <p className="text-[15px] font-semibold">Neue Ersatzcodes</p>
                    <Field label="Passwort zur Bestätigung" name="password" type="password" autoComplete="current-password" required />
                    <div>
                      <SubmitButton variant="ghost">Neue Codes erzeugen</SubmitButton>
                    </div>
                  </ActionForm>
                  <ActionForm action={turnOffTwoFactor} resetOnSuccess>
                    <p className="text-[15px] font-semibold">Ausschalten</p>
                    <Field label="Passwort zur Bestätigung" name="password" type="password" autoComplete="current-password" required />
                    <div>
                      <SubmitButton variant="danger">Zweiten Faktor ausschalten</SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              </div>
            ) : totp?.pending ? (
              <div className="grid gap-6 md:grid-cols-[200px_1fr] md:items-start">
                <div
                  className="w-full max-w-[200px] overflow-hidden rounded-xl border border-line"
                  role="img"
                  aria-label="QR-Code für die Authenticator-App"
                  dangerouslySetInnerHTML={{ __html: qrSvg(otpauthUrl(totp.pending, admin.email, "marcel-richter Admin")) }}
                />
                <div className="grid gap-4">
                  <ol className="list-decimal space-y-1 pl-5 text-[15px]">
                    <li>QR-Code mit der Authenticator-App bzw. der Kamera scannen.</li>
                    <li>Den angezeigten sechsstelligen Code unten eingeben.</li>
                  </ol>
                  <p className="text-sm text-muted">
                    Ohne Kamera: Schlüssel von Hand eingeben –{" "}
                    <code className="font-mono text-fg select-all">{readableSecret(totp.pending)}</code>
                  </p>
                  <ActionForm action={confirmTwoFactor}>
                    <Field label="Code aus der App" name="code" autoComplete="one-time-code" inputMode="numeric" placeholder="123456" required />
                    <div className="flex flex-wrap gap-3">
                      <SubmitButton>Bestätigen und einschalten</SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              </div>
            ) : (
              <ActionButton action={startTwoFactor} variant="primary">
                Zweiten Faktor einrichten
              </ActionButton>
            )}
          </Section>

          <Section
            id="mailversand"
            title="Mailversand"
            lead="Damit Nachrichten aus dem Kontaktformular zusätzlich per Mail ankommen. Ohne Mailversand landen sie nur im Postfach hier."
          >
            {envMail ? (
              <p className="rounded-xl bg-surface px-4 py-3 text-[15px]">
                Wird über die Server-Umgebung gesteuert (<code className="font-mono">SMTP_HOST={envMail.host}</code>, an{" "}
                {envMail.to}). Die Umgebung hat Vorrang vor den Einstellungen hier.
              </p>
            ) : (
              <div className="grid gap-5">
                {mail ? (
                  <p className="rounded-xl bg-win-soft px-4 py-3 font-medium text-win">
                    Eingerichtet ({mail.host}:{mail.port}), zuletzt geändert {date(mail.changedAt)}.
                  </p>
                ) : null}
                <ActionForm action={saveMail}>
                  <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
                    <Field label="Mailserver (SMTP)" name="host" defaultValue={mail?.host} placeholder="smtp.example.com" required />
                    <Field label="Port" name="port" defaultValue={mail?.port ?? 587} inputMode="numeric" hint="587 oder 465" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Benutzer" name="user" defaultValue={mail?.user} autoComplete="off" />
                    <Field
                      label="Passwort"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder={mail?.passwordSet ? "unverändert" : undefined}
                    />
                  </div>
                  {mail?.passwordSet ? <Checkbox label="Gespeichertes Passwort entfernen" name="clearPassword" /> : null}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Absender" name="from" type="email" defaultValue={mail?.from ?? mail?.user} placeholder="website@example.com" required />
                    <Field label="Empfänger" name="to" type="email" defaultValue={mail?.to} placeholder={site.email} hint={`Leer = ${site.email}`} />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <SubmitButton pendingText="Sende Testmail …">Testen und speichern</SubmitButton>
                  </div>
                </ActionForm>
                {mail ? (
                  <ActionButton action={removeMail} confirm="Mailversand entfernen? Nachrichten landen dann nur noch im Postfach." variant="danger">
                    Mailversand entfernen
                  </ActionButton>
                ) : null}
              </div>
            )}
          </Section>

          <Section id="datenbank" title="Datenbank" lead="MongoDB, im Einrichtungsassistenten verbunden. Ändern: ./start.sh --einrichtung-zuruecksetzen">
            {connection ? (
              <dl className="grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-[auto_1fr]">
                <dt className="text-muted">Server</dt>
                <dd className="font-mono">{connection.server}</dd>
                <dt className="text-muted">Datenbank</dt>
                <dd className="font-mono">{connection.database}</dd>
                <dt className="text-muted">Benutzer</dt>
                <dd className="font-mono">{connection.user || "–"}</dd>
                <dt className="text-muted">Verschlüsselt (TLS)</dt>
                <dd>{connection.tls ? "ja" : "nein"}</dd>
              </dl>
            ) : null}
            <ActionForm action={checkDatabase} className="mt-5 grid gap-4">
              <div>
                <SubmitButton variant="ghost" pendingText="Prüfe …">
                  Verbindung prüfen
                </SubmitButton>
              </div>
            </ActionForm>
          </Section>

          <Section id="sitzungen" title="Sitzungen" lead="Eine Anmeldung gilt 12 Stunden. Hier lassen sich alle Geräte auf einmal abmelden.">
            <ActionButton action={logoutEverywhere} confirm="Alle Geräte abmelden, auch dieses?">
              Überall abmelden
            </ActionButton>
          </Section>
        </div>
      </div>
    </AdminShell>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titel`} className="card scroll-mt-24 p-6 sm:p-8">
      <h2 id={`${id}-titel`} className="text-lg font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      <p className="mt-1 mb-6 text-[15px] text-muted">{lead}</p>
      {children}
    </section>
  );
}
