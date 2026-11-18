import type { Metadata } from "next";
import Link from "next/link";

import { setStatistics } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/shell";
import { Toggle } from "@/components/admin/toggle";
import { Badge, PageHead, Panel, StatTile } from "@/components/admin/ui";
import { VisitsChart } from "@/components/admin/visits-chart";
import { adminPrefix, requireAdmin } from "@/lib/admin/guard";
import { type Ranked, type StatisticsReport, statisticsReport } from "@/lib/admin/statistics";
import { SITE_URL } from "@/lib/site-url";
import { websiteSettings } from "@/lib/website-settings";

export const metadata: Metadata = { title: "Besucher" };

const RANGES = [7, 30, 90] as const;

function RankList({ items, total, link }: { items: Ranked[]; total: number; link?: (key: string) => string }) {
  if (items.length === 0) return <p className="text-sm text-muted">Noch keine Daten.</p>;
  return (
    <ul className="grid gap-2.5">
      {items.map((item) => {
        const share = total ? Math.round((item.views / total) * 100) : 0;
        return (
          <li key={item.key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3 text-[14.5px]">
              {link ? (
                <a href={link(item.key)} target="_blank" rel="noopener" className="min-w-0 truncate hover:text-accent">
                  {item.key}
                </a>
              ) : (
                <span className="min-w-0 truncate">{item.key}</span>
              )}
              <span className="shrink-0 font-mono text-[12px] text-muted tabular-nums">
                {item.views} · {share} %
              </span>
            </div>
            <div aria-hidden="true" className="h-1.5 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-chart" style={{ width: `${Math.max(share, 1)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ tage?: string }> }) {
  const admin = await requireAdmin("/besucher");
  const prefix = await adminPrefix();
  const requested = Number((await searchParams).tage);
  const range = (RANGES as readonly number[]).includes(requested) ? requested : 30;
  const enabled = websiteSettings().statistics;

  let report: StatisticsReport | null = null;
  try {
    report = await statisticsReport(range);
  } catch {
    report = null;
  }

  const tab = (active: boolean) =>
    `inline-flex h-9 items-center rounded-lg px-3 text-[14.5px] font-medium ${active ? "bg-bg text-fg shadow-soft" : "text-muted hover:text-fg"}`;
  const deviceLabel: Record<string, string> = { mobil: "Smartphone", tablet: "Tablet", desktop: "Computer" };

  return (
    <AdminShell admin={admin}>
      <PageHead
        title="Besucher"
        text="Ohne Cookies und ohne Drittanbieter auf dem eigenen Server gezählt – Bots und „Do Not Track“ ausgenommen."
        action={
          <nav aria-label="Zeitraum" className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
            {RANGES.map((days) => (
              <Link key={days} href={`${prefix}/besucher?tage=${days}`} aria-current={days === range ? "page" : undefined} className={tab(days === range)}>
                {days} Tage
              </Link>
            ))}
          </nav>
        }
      />

      <section className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Besucherstatistik erfassen</h2>
          <p className="mt-1 text-sm text-muted">
            {enabled
              ? "Läuft. Die Datenschutzerklärung beschreibt sie in Abschnitt 13."
              : "Aus – es wird nichts gezählt, Abschnitt 13 der Datenschutzerklärung entfällt."}
          </p>
        </div>
        <Toggle checked={enabled} action={setStatistics} label="Besucherstatistik erfassen" onText="erfasst" offText="aus" />
      </section>

      {!report ? (
        <p className="rounded-xl bg-loss-soft px-4 py-3 font-medium text-loss">Die Datenbank antwortet nicht. Bitte später erneut versuchen.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon="chart" value={report.totals.views} label="Seitenaufrufe" hint={`in ${range} Tagen`} />
            <StatTile icon="user" value={report.totals.visitors} label="Besucher" hint="je Tag gezählt, aufsummiert" />
            <StatTile icon="calendar" value={report.today.views} label="Aufrufe heute" hint={`${report.today.visitors} Besucher`} />
            <StatTile
              icon="pages"
              value={report.totals.visitors ? (report.totals.views / report.totals.visitors).toFixed(1).replace(".", ",") : "–"}
              label="Seiten je Besuch"
              hint="Durchschnitt"
            />
          </div>

          <Panel title="Seitenaufrufe je Tag" className="mt-6">
            <VisitsChart days={report.days} />
          </Panel>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Panel title="Beliebteste Seiten" className="lg:col-span-2">
              <RankList items={report.pages} total={report.totals.views} link={(path) => `${SITE_URL}${path}`} />
            </Panel>
            <div className="grid content-start gap-6">
              <Panel title="Herkunft" text="Von welchen Seiten Besucher kamen.">
                <RankList items={report.sources} total={report.sources.reduce((sum, item) => sum + item.views, 0)} />
              </Panel>
              <Panel title="Geräte">
                <RankList
                  items={report.devices.map((item) => ({ ...item, key: deviceLabel[item.key] ?? item.key }))}
                  total={report.devices.reduce((sum, item) => sum + item.views, 0)}
                />
              </Panel>
            </div>
          </div>
          {report.totals.views === 0 ? (
            <p className="mt-6 text-sm text-muted">
              <Badge tone="neutral">Hinweis</Badge> Gezählt wird ab jetzt – die ersten Zahlen erscheinen nach den ersten Besuchen
              (alle 15 Sekunden gespeichert).
            </p>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
