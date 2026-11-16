import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SetupWizard } from "@/components/admin/setup-wizard";
import { AdminShell } from "@/components/admin/shell";
import { databaseConfigured } from "@/lib/admin/db";
import { adminPrefix, requireAdmin, setupComplete } from "@/lib/admin/guard";
import { countUnread, listMessages } from "@/lib/admin/messages";
import { dataDirPersistent, wizardDone } from "@/lib/admin/storage";
import { mailConfig } from "@/lib/contact";
import { getSite } from "@/lib/content";
import { liveStatus } from "@/lib/live";
import { bvvStatus, snapshotDates } from "@/lib/season";

export const metadata: Metadata = { title: "Übersicht" };

/** Startzeit des Serverprozesses (einmal beim Laden des Moduls bestimmt) */
const PROCESS_STARTED = new Date(Date.now() - process.uptime() * 1000);

const dateTime = (value?: string | Date) =>
  value
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value))
    : "–";

export default async function AdminHome() {
  // Vor der Einrichtung: der einmalige Assistent
  if (!setupComplete()) {
    if (wizardDone()) return <Broken />;
    const site = getSite("de");
    return (
      <main className="flex flex-1 justify-center bg-surface px-4 py-12 sm:py-20">
        <SetupWizard
          step={databaseConfigured() ? 2 : 1}
          persistent={dataDirPersistent()}
          defaults={{ name: site.name, email: site.email }}
        />
      </main>
    );
  }

  const admin = await requireAdmin("/");
  const prefix = await adminPrefix();
  const [unread, latest, mail] = await Promise.all([
    countUnread().catch(() => null),
    listMessages(3).catch(() => []),
    mailConfig(),
  ]);
  const ticker = liveStatus();
  const snapshots = Object.entries(snapshotDates());

  return (
    <AdminShell admin={admin} title={`Hallo ${admin.name.split(" ")[0]}`}>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatusCard
          title="Nachrichten"
          tone={unread ? "accent" : "neutral"}
          value={unread === null ? "–" : unread === 0 ? "Alles gelesen" : `${unread} ungelesen`}
          link={{ href: `${prefix}/nachrichten`, label: "Zum Postfach" }}
        >
          {latest.length > 0 ? (
            <ul className="mt-3 divide-y divide-line text-[14.5px]">
              {latest.map((message) => (
                <li key={message.id} className="flex justify-between gap-3 py-2">
                  <span className={`truncate ${message.read ? "text-muted" : "font-medium"}`}>{message.name}</span>
                  <span className="shrink-0 font-mono text-[12px] text-muted">{dateTime(message.receivedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Noch keine Nachricht über das Kontaktformular.</p>
          )}
        </StatusCard>

        <StatusCard
          title="Mailversand"
          tone={mail ? "win" : "loss"}
          value={mail ? "Eingerichtet" : "Nicht eingerichtet"}
          link={{ href: `${prefix}/einstellungen#mailversand`, label: mail ? "Einstellungen" : "Jetzt einrichten" }}
        >
          <p className="mt-2 text-sm text-muted">
            {mail
              ? `Nachrichten gehen an ${mail.to} (${mail.source === "umgebung" ? "aus der Server-Umgebung" : "im Admin-Bereich eingerichtet"}).`
              : "Nachrichten landen trotzdem hier im Postfach – nur ohne Mail-Benachrichtigung."}
          </p>
        </StatusCard>

        <StatusCard
          title="Sicherheit"
          tone={admin.twoFactor ? "win" : "loss"}
          value={admin.twoFactor ? "Zweiter Faktor aktiv" : "Nur Passwort"}
          link={{ href: `${prefix}/einstellungen#zwei-faktor`, label: admin.twoFactor ? "Verwalten" : "Zweiten Faktor einschalten" }}
        >
          <p className="mt-2 text-sm text-muted">Letzte Anmeldung: {dateTime(admin.lastLoginAt)}</p>
        </StatusCard>

        <StatusCard
          title="Spielplan (BVV)"
          tone={bvvStatus.lastFailure && (!bvvStatus.lastSuccess || bvvStatus.lastFailure.at > bvvStatus.lastSuccess) ? "loss" : "neutral"}
          value={bvvStatus.lastSuccess ? `Zuletzt abgerufen ${dateTime(bvvStatus.lastSuccess)}` : "Seit dem Start nicht abgerufen"}
        >
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {bvvStatus.lastFailure ? (
              <li>
                Letzter Fehler {dateTime(bvvStatus.lastFailure.at)}: {bvvStatus.lastFailure.message}
              </li>
            ) : null}
            {snapshots.map(([id, at]) => (
              <li key={id}>
                Letzter bekannter Stand {id}: {dateTime(at)}
              </li>
            ))}
          </ul>
        </StatusCard>

        <StatusCard
          title="Live-Ticker"
          tone={ticker.lastError ? "loss" : "neutral"}
          value={ticker.connected ? `Verbunden · ${ticker.matches} Spiele` : ticker.loadedAt ? "Ruht (kein Spiel heute)" : "Seit dem Start nicht genutzt"}
        >
          <p className="mt-2 text-sm text-muted">
            {ticker.lastError ? `Letzter Fehler: ${ticker.lastError}` : `Zuletzt geladen: ${dateTime(ticker.loadedAt)}`}
          </p>
        </StatusCard>

        <StatusCard title="Version" tone="neutral" value={(process.env.GIT_SHA ?? "dev").slice(0, 7)}>
          <p className="mt-2 text-sm text-muted">
            Prozess läuft seit {dateTime(PROCESS_STARTED)}.
          </p>
        </StatusCard>
      </div>
    </AdminShell>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  win: "bg-win-soft text-win",
  loss: "bg-loss-soft text-loss",
} as const;

function StatusCard({
  title,
  value,
  tone,
  link,
  children,
}: {
  title: string;
  value: string;
  tone: keyof typeof TONES;
  link?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <section className="card flex flex-col p-6">
      <h2 className="eyebrow">{title}</h2>
      <p className="mt-3">
        <span className={`inline-block rounded-full px-3 py-1 text-[15px] font-semibold ${TONES[tone]}`}>{value}</span>
      </p>
      <div className="flex-1">{children}</div>
      {link ? (
        <a href={link.href} className="arrow-link mt-4 text-[14.5px]">
          {link.label}
        </a>
      ) : null}
    </section>
  );
}

function Broken() {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-4 py-16">
      <div className="card max-w-lg p-8">
        <h1 className="text-xl font-semibold">Datenbankverbindung nicht lesbar</h1>
        <p className="mt-3 text-muted">
          Die Einrichtung ist abgeschlossen, aber die gespeicherte Verbindung lässt sich nicht lesen – meist, weil das
          Volume mit dem App-Geheimnis gewechselt wurde. Auf dem Server neu einrichten:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-surface p-4 font-mono text-sm">./start.sh --einrichtung-zuruecksetzen</pre>
      </div>
    </main>
  );
}
