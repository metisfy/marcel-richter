import type { Metadata } from "next";

import { refreshSeasonData } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/admin/forms";
import { AdminShell } from "@/components/admin/shell";
import { Badge, InfoList, PageHead, Panel, formatDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { type Fixture, lastResult, nextMatchday } from "@/lib/content";
import { liveStatus } from "@/lib/live";
import { bvvStatus, loadSeasons, snapshotDates } from "@/lib/season";
import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";

export const metadata: Metadata = { title: "Spielbetrieb" };

const when = (date: string) =>
  new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(date.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Berlin",
  }).format(new Date(date.length > 10 ? date.replace(" ", "T") : `${date}T12:00:00`));

function FixtureRow({ fixture }: { fixture: Fixture }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <span className="min-w-0">
        <span className="block font-medium">
          {fixture.teams.map((team, index) => (
            <span key={team} className={index === fixture.own ? "font-semibold" : "font-normal text-muted"}>
              {index > 0 ? " – " : ""}
              {team}
            </span>
          ))}
        </span>
        <span className="block text-sm text-muted">
          {when(fixture.date)}
          {fixture.venue ? ` · ${fixture.venue}` : ""}
        </span>
      </span>
      {fixture.result ? (
        <span className="flex items-center gap-2">
          {fixture.outcome ? <Badge tone={fixture.outcome === "win" ? "good" : "bad"}>{fixture.outcome === "win" ? "Sieg" : "Niederlage"}</Badge> : null}
          <span className="text-lg font-semibold tabular-nums">{fixture.result.join(":")}</span>
        </span>
      ) : null}
    </li>
  );
}

export default async function MatchesPage() {
  const admin = await requireAdmin("/spielbetrieb");
  const seasons = await loadSeasons("de").catch(() => []);
  const season = seasons[0];
  const next = nextMatchday(season);
  const last = lastResult(season);
  const ticker = liveStatus();
  const snapshots = snapshotDates();
  const site = SITE_URL_CONFIGURED ? SITE_URL : "";

  const source = season?.source;
  const sourceBadge = !source ? (
    <Badge tone="neutral">von Hand gepflegt</Badge>
  ) : source.stale || !source.updatedAt ? (
    <Badge tone="warn">letzter bekannter Stand</Badge>
  ) : (
    <Badge tone="good">live vom BVV</Badge>
  );

  return (
    <AdminShell admin={admin}>
      <PageHead
        title="Spielbetrieb"
        text="Spielplan, Tabelle und Live-Ticker – die Website holt alles selbst vom BVV."
        action={
          <ActionForm action={refreshSeasonData} className="flex flex-col items-end gap-2">
            <SubmitButton variant="ghost" small pendingText="Frage beim BVV an …">
              Jetzt neu abrufen
            </SubmitButton>
          </ActionForm>
        }
      />

      {!season ? (
        <p className="card p-8 text-center text-muted">Keine Saison gefunden (content/saison/).</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="grid content-start gap-6">
            <Panel title="Nächster Spieltag" action={next[0] ? <Badge tone="accent">{next.length} Spiele</Badge> : undefined}>
              {next.length ? (
                <ul className="divide-y divide-line">
                  {next.map((fixture) => (
                    <FixtureRow key={`${fixture.date}-${fixture.teams.join()}`} fixture={fixture} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Kein Spiel angesetzt.</p>
              )}
            </Panel>

            <Panel title="Letztes Ergebnis">
              {last ? (
                <ul className="divide-y divide-line">
                  <FixtureRow fixture={last} />
                </ul>
              ) : (
                <p className="text-sm text-muted">Noch kein Spiel gespielt.</p>
              )}
            </Panel>

            <Panel title="Datenquellen" text="Zustand seit dem letzten Start des Servers.">
              <InfoList
                rows={[
                  { label: "BVV zuletzt erreicht", value: formatDateTime(bvvStatus.lastSuccess) },
                  {
                    label: "BVV letzter Fehler",
                    value: bvvStatus.lastFailure ? `${formatDateTime(bvvStatus.lastFailure.at)} – ${bvvStatus.lastFailure.message}` : "–",
                  },
                  {
                    label: "Live-Ticker",
                    value: ticker.connected ? `verbunden · ${ticker.matches} Spiele` : ticker.loadedAt ? `ruht · zuletzt ${formatDateTime(ticker.loadedAt)}` : "seit dem Start nicht genutzt",
                  },
                  ...(ticker.lastError ? [{ label: "Ticker-Fehler", value: `${formatDateTime(ticker.lastError.at)} – ${ticker.lastError.message}` }] : []),
                  ...Object.entries(snapshots).map(([id, at]) => ({ label: `Letzter bekannter Stand ${id}`, value: formatDateTime(at) })),
                ]}
              />
            </Panel>
          </div>

          <div className="grid content-start gap-6">
            <Panel title={`Saison ${season.season}`} text={season.league} action={sourceBadge}>
              <InfoList
                rows={[
                  {
                    label: "Tabellenplatz",
                    value: season.standing ? `${season.standing.position}. von ${season.standing.teams}${season.standing.points !== undefined ? ` · ${season.standing.points} Punkte` : ""}` : "–",
                  },
                  {
                    label: "Bilanz",
                    value: season.record ? `${season.record.won} Siege · ${season.record.lost} Niederlagen` : "–",
                  },
                  {
                    label: "Meine Einsätze",
                    value: season.appearances ? `${season.appearances.played} von ${season.appearances.matches} Spielen` : "–",
                  },
                  { label: "Spiele im Plan", value: season.fixtures.length },
                  { label: "Datenstand", value: formatDateTime(source?.updatedAt) },
                ]}
              />
              <div className="mt-5 flex flex-wrap gap-2.5">
                <a href={`${site}/saison`} target="_blank" rel="noopener" className="btn btn-ghost btn-nav">
                  Spielplan öffnen
                </a>
                <a href={`${site}/spielplan.ics`} className="btn btn-ghost btn-nav">
                  Kalender (.ics)
                </a>
                {source?.url ? (
                  <a href={source.url} target="_blank" rel="noopener" className="btn btn-ghost btn-nav">
                    Ligaseite beim BVV
                  </a>
                ) : null}
              </div>
            </Panel>

            <Panel title="Alle Saisons" text="Dateien unter content/saison/.">
              <ul className="divide-y divide-line text-[15px]">
                {seasons.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span>
                      <span className="font-medium">{entry.season}</span> <span className="text-muted">· {entry.league}</span>
                    </span>
                    <span className="font-mono text-[12px] text-muted">{entry.fixtures.length} Spiele</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
