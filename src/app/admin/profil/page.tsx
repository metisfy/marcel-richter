import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  confirmTwoFactor,
  deletePasskey,
  logoutEverywhere,
  renewBackupCodes,
  savePassword,
  saveProfile,
  startTwoFactor,
  turnOffTwoFactor,
} from "@/app/admin/actions";
import { ActionButton, ActionForm, Field, SubmitButton } from "@/components/admin/forms";
import { AdminIcon } from "@/components/admin/icons";
import { AddPasskey } from "@/components/admin/passkey";
import { AdminShell } from "@/components/admin/shell";
import { Badge, PageHead, Panel, formatDateTime } from "@/components/admin/ui";
import { totpSecretOf } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/admin/guard";
import { otpauthUrl, qrSvg, readableSecret } from "@/lib/admin/totp";

export const metadata: Metadata = { title: "Mein Profil" };

export default async function ProfilePage() {
  const admin = await requireAdmin("/profil");
  const totp = await totpSecretOf(admin.id).catch(() => null);

  return (
    <AdminShell admin={admin}>
      <div className="mx-auto max-w-3xl">
        <PageHead title="Mein Profil" text={`Angemeldet als ${admin.email} · zuletzt ${formatDateTime(admin.lastLoginAt)}`} />

        <div className="grid gap-6">
          <Panel id="konto" title="Konto" text="Name und E-Mail-Adresse für die Anmeldung.">
            <ActionForm action={saveProfile}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" name="name" defaultValue={admin.name} autoComplete="name" required />
                <Field label="E-Mail-Adresse" name="email" type="email" defaultValue={admin.email} autoComplete="username" required />
              </div>
              <div>
                <SubmitButton>Speichern</SubmitButton>
              </div>
            </ActionForm>
          </Panel>

          <Panel id="passwort" title="Passwort" text="Nach dem Wechsel sind alle anderen Geräte abgemeldet.">
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
          </Panel>

          <Panel
            id="zwei-faktor"
            title="Zwei-Faktor-Anmeldung"
            text="Nach dem Passwort zusätzlich ein Passkey oder ein Code aus der Authenticator-App. Beides lässt sich kombinieren."
            action={admin.twoFactor ? <Badge tone="good">aktiv</Badge> : <Badge tone="bad">aus</Badge>}
          >
            <div className="grid gap-8">
              <Method
                icon="shield"
                title="Passkeys"
                text="Face ID, Touch ID, Windows Hello, Fingerabdruck oder Sicherheitsschlüssel – der bequemste und sicherste Weg. Funktioniert über https://admin.<domain> oder localhost."
              >
                {admin.passkeys.length ? (
                  <ul className="mb-5 divide-y divide-line rounded-xl border border-line">
                    {admin.passkeys.map((passkey) => (
                      <li key={passkey.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0">
                          <span className="block font-medium">{passkey.name}</span>
                          <span className="block text-sm text-muted">
                            angelegt {formatDateTime(passkey.createdAt)} · zuletzt benutzt {formatDateTime(passkey.lastUsedAt)}
                          </span>
                        </span>
                        <ActionButton action={deletePasskey.bind(null, passkey.id)} confirm={`Passkey „${passkey.name}“ entfernen?`} variant="danger">
                          Entfernen
                        </ActionButton>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <AddPasskey />
              </Method>

              <Method icon="calendar" title="Authenticator-App" text="Sechsstelliger Code aus iPhone-Passwörter, Google Authenticator, 1Password o. Ä.">
                {admin.totp ? (
                  <div className="grid gap-4">
                    <p className="text-[15px]">
                      <Badge tone="good">aktiv</Badge> <span className="ml-1 text-muted">seit {formatDateTime(admin.totpSince)}</span>
                    </p>
                    <ActionForm action={turnOffTwoFactor} resetOnSuccess className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                      <Field label="Passwort zum Ausschalten" name="password" type="password" autoComplete="current-password" required />
                      <SubmitButton variant="danger">App ausschalten</SubmitButton>
                    </ActionForm>
                  </div>
                ) : totp?.pending ? (
                  <div className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-start">
                    <div
                      className="w-full max-w-[180px] overflow-hidden rounded-xl border border-line"
                      role="img"
                      aria-label="QR-Code für die Authenticator-App"
                      dangerouslySetInnerHTML={{ __html: qrSvg(otpauthUrl(totp.pending, admin.email, "marcel-richter Admin")) }}
                    />
                    <div className="grid gap-4">
                      <ol className="list-decimal space-y-1 pl-5 text-[15px]">
                        <li>QR-Code mit der App bzw. der Kamera scannen.</li>
                        <li>Den sechsstelligen Code unten eingeben.</li>
                      </ol>
                      <p className="text-sm text-muted">
                        Ohne Kamera: <code className="font-mono text-fg select-all">{readableSecret(totp.pending)}</code>
                      </p>
                      <ActionForm action={confirmTwoFactor}>
                        <Field label="Code aus der App" name="code" autoComplete="one-time-code" inputMode="numeric" placeholder="123456" required />
                        <div>
                          <SubmitButton>Bestätigen und einschalten</SubmitButton>
                        </div>
                      </ActionForm>
                    </div>
                  </div>
                ) : (
                  <ActionButton action={startTwoFactor}>App einrichten</ActionButton>
                )}
              </Method>

              {admin.twoFactor ? (
                <Method icon="pages" title="Ersatzcodes" text={`Für den Notfall ohne Telefon und Passkey – ${admin.backupCodesLeft} von 8 übrig, jeder gilt einmal.`}>
                  <ActionForm action={renewBackupCodes} resetOnSuccess className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field label="Passwort für neue Codes" name="password" type="password" autoComplete="current-password" required />
                    <SubmitButton variant="ghost">Neue Codes erzeugen</SubmitButton>
                  </ActionForm>
                </Method>
              ) : null}
            </div>
          </Panel>

          <Panel id="sitzungen" title="Sitzungen" text="Eine Anmeldung gilt 12 Stunden. Hier lassen sich alle Geräte auf einmal abmelden.">
            <ActionButton action={logoutEverywhere} confirm="Alle Geräte abmelden, auch dieses?">
              Überall abmelden
            </ActionButton>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}

function Method({ icon, title, text, children }: { icon: "shield" | "calendar" | "pages"; title: string; text: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-[40px_1fr]">
      <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
        <AdminIcon name={icon} />
      </span>
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-0.5 mb-4 text-sm text-muted">{text}</p>
        {children}
      </div>
    </div>
  );
}
