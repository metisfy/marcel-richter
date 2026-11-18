import type { Metadata } from "next";
import Link from "next/link";

import { SetupWizard } from "@/components/admin/setup-wizard";
import { AdminShell } from "@/components/admin/shell";
import { Badge, type BadgeTone, Panel, PageHead, StatTile, formatDateTime } from "@/components/admin/ui";
import { databaseConfigured } from "@/lib/admin/db";
import { adminPrefix, requireAdmin, setupComplete } from "@/lib/admin/guard";
import { countUnread, listMessages } from "@/lib/admin/messages";
import { statisticsReport } from "@/lib/admin/statistics";
import { dataDirPersistent, wizardDone } from "@/lib/admin/storage";
import { mailStatus } from "@/lib/contact";
import { getSite, lastResult, nextMatchday } from "@/lib/content";
import { loadCurrentSeason } from "@/lib/season";
import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";
import { websiteSettings } from "@/lib/website-settings";

export const metadata: Metadata = { title: "Dashboard" };

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));

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
          fixCommand={`cd ~/websites/intern/marcel-richter && curl -fsSLO https://raw.githubusercontent.com/metisfy/marcel-richter/main/start.sh && chmod +x start.sh && ./start.sh ${process.env.GIT_SHA && /^[0-9a-f]{40}$/.test(process.env.GIT_SHA) ? process.env.GIT_SHA : ""}`.trim()}
        />
      </main>
    );
  }

  const admin = await requireAdmin("/");
  const prefix = await adminPrefix();
  const [unread, latest, mail, season, visits] = await Promise.all([
    countUnread().catch(() => null),
    listMessages(5).catch(() => []),
    mailStatus(),
    loadCurrentSeason("de").catch(() => undefined),
    statisticsReport(7).catch(() => null),
  ]);
  const indexed = SITE_URL_CONFIGURED && websiteSettings().indexing;
  const next = nextMatchday(season);
  const last = lastResult(season);
  const dataTone: BadgeTone = !season?.source ? "neutral" : season.source.stale || !season.source.updatedAt ? "warn" : "good";

  const checks: { label: string; text: string; tone: BadgeTone; status: string; href: string }[] = [
    {
      label: "Zweiter Faktor",
      text: admin.twoFactor
        ? [admin.passkeys.length ? `${admin.passkeys.length} Passkey${admin.passkeys.length > 1 ? "s" : ""}` : "", admin.totp ? "Authenticator-App" : ""]
            .filter(Boolean)
            .join(" · ")
        : "Nur Passwort – Passkey oder App einrichten",
      tone: admin.twoFactor ? "good" : "bad",
      status: admin.twoFactor ? "aktiv" : "fehlt",
      href: `${prefix}/profil#zwei-faktor`,
    },
    {
      label: "Mailversand",
      text:
        mail.state === "umgebung" || mail.state === "admin"
          ? `Nachrichten gehen an ${mail.to}`
          : mail.state === "unlesbar"
            ? "Passwort nicht mehr lesbar – bitte neu eingeben"
            : "Nachrichten landen nur im Postfach hier",
      tone: mail.state === "umgebung" || mail.state === "admin" ? "good" : mail.state === "unlesbar" ? "bad" : "warn",
      status: mail.state === "umgebung" || mail.state === "admin" ? "eingerichtet" : mail.state === "unlesbar" ? "Passwort fehlt" : "fehlt",
      href: `${prefix}/einstellungen/mailversand`,
    },
    {
      label: "Domain & Suchmaschinen",
      text: indexed ? SITE_URL.replace(/^https?:\/\//, "") : "Für Google & Co. gesperrt (Regler unter Inhalte & SEO)",
      tone: indexed ? "good" : "warn",
      status: indexed ? "öffentlich" : "noindex",
      href: `${prefix}/inhalte#seo`,
    },
    {
      label: "Spielplan vom BVV",
      text: season?.source?.updatedAt ? `Stand ${formatDateTime(season.source.updatedAt)}` : "Noch kein Stand",
      tone: dataTone,
      status: dataTone === "good" ? "aktuell" : dataTone === "warn" ? "letzter Stand" : "–",
      href: `${prefix}/spielbetrieb`,
    },
  ];

  return (
    <AdminShell admin={admin}>
      <PageHead
        title={`Hallo ${admin.name.split(" ")[0]}`}
        text="Das Wichtigste zur Website auf einen Blick."
        action={
          <a href={SITE_URL_CONFIGURED ? SITE_URL : "/"} target="_blank" rel="noopener" className="btn btn-ghost btn-nav">
            Website öffnen
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon="chart"
          value={visits?.totals.visitors ?? "–"}
          label="Besucher (7 Tage)"
          hint={visits ? `${visits.totals.views} Seitenaufrufe · heute ${visits.today.views}` : "Statistik nicht verfügbar"}
          href={`${prefix}/besucher`}
        />
        <StatTile
          icon="inbox"
          value={unread ?? "–"}
          label="Ungelesene Nachrichten"
          hint={latest[0] ? `Zuletzt ${formatDateTime(latest[0].receivedAt)}` : "Noch keine Nachricht"}
          href={`${prefix}/nachrichten`}
        />
        <StatTile
          icon="calendar"
          value={next[0] ? dayLabel(next[0].date) : "–"}
          label="Nächster Spieltag"
          hint={next[0] ? `${next.length} Spiel${next.length > 1 ? "e" : ""}${next[0].venue ? ` · ${next[0].venue}` : ""}` : "Kein Spiel angesetzt"}
          href={`${prefix}/spielbetrieb`}
        />
        <StatTile
          icon="trophy"
          value={season?.standing ? `${season.standing.position}.` : "–"}
          label="Tabellenplatz"
          hint={season?.standing ? `von ${season.standing.teams}${season.standing.points !== undefined ? ` · ${season.standing.points} Punkte` : ""}` : season?.league}
          href={`${prefix}/spielbetrieb`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Status" text="Was eingerichtet ist und was noch fehlt.">
          <ul className="divide-y divide-line">
            {checks.map((check) => (
              <li key={check.label}>
                <Link href={check.href} className="-mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-3 hover:bg-surface">
                  <span className="min-w-0">
                    <span className="block font-medium">{check.label}</span>
                    <span className="block truncate text-sm text-muted">{check.text}</span>
                  </span>
                  <Badge tone={check.tone}>{check.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Neueste Nachrichten"
          text="Aus dem Kontaktformular."
          action={
            <Link href={`${prefix}/nachrichten`} className="arrow-link text-[14.5px]">
              Alle
            </Link>
          }
        >
          {latest.length === 0 ? (
            <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-muted">Noch keine Nachricht.</p>
          ) : (
            <ul className="divide-y divide-line">
              {latest.map((message) => (
                <li key={message.id}>
                  <Link href={`${prefix}/nachrichten#n-${message.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface">
                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${message.read ? "bg-line" : "bg-accent"}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${message.read ? "" : "font-semibold"}`}>{message.name}</span>
                      <span className="block truncate text-sm text-muted">{message.message}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11.5px] text-muted">{formatDateTime(message.receivedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {last?.result ? (
        <p className="mt-6 text-sm text-muted">
          Letztes Ergebnis: {last.teams.join(" – ")} {last.result.join(":")} ({dayLabel(last.date)})
        </p>
      ) : null}
    </AdminShell>
  );
}

function Broken() {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-4 py-16">
      <div className="card max-w-lg p-8">
        <h1 className="text-xl font-semibold">Datenbankverbindung nicht lesbar</h1>
        <p className="mt-3 text-muted">
          Die Einrichtung ist abgeschlossen, aber die gespeicherte Verbindung lässt sich nicht lesen – meist, weil das Volume mit dem
          App-Geheimnis gewechselt wurde. Auf dem Server neu einrichten:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-surface p-4 font-mono text-sm">./start.sh --einrichtung-zuruecksetzen</pre>
      </div>
    </main>
  );
}
