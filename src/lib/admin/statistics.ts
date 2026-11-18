import "server-only";

import type { AnyBulkWriteOperation } from "mongodb";

import { visitQueue } from "@/lib/visits";
import { websiteSettings } from "@/lib/website-settings";

import { database } from "./db";
import { setupComplete } from "./guard";

/*
 * Besucherstatistik, Teil 2: Zusammenfassen und Auswerten.
 *
 * Sammlung `statistik`, je Tag nur Summen:
 *   { _id: "tag|2026-11-18",              kind: "tag",    day, views, visitors }
 *   { _id: "seite|2026-11-18|/projekte",  kind: "seite",  day, key, views }
 *   { _id: "quelle|2026-11-18|google.com",kind: "quelle", day, key, views }
 *   { _id: "geraet|2026-11-18|mobil",     kind: "geraet", day, key, views }
 * Sammlung `statistik_besucher`: Prüfsumme je Tag (nur zum einmaligen Zählen),
 * verfällt nach 48 Stunden von selbst.
 */

type Row = { _id: string; kind: "tag" | "seite" | "quelle" | "geraet"; day: string; key?: string; views: number; visitors?: number; expiresAt: Date };
type VisitorRow = { _id: string; expiresAt: Date };

const KEEP_DAYS = 760; // gut zwei Jahre Summen

let indexesReady = false;

async function collections() {
  const db = await database();
  const stats = db.collection<Row>("statistik");
  const visitors = db.collection<VisitorRow>("statistik_besucher");
  if (!indexesReady) {
    await stats.createIndex({ kind: 1, day: 1 });
    await stats.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await visitors.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    indexesReady = true;
  }
  return { stats, visitors };
}

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** Gesammelte Aufrufe in die Datenbank schreiben (läuft alle paar Sekunden, src/instrumentation.ts). */
export async function flushVisits(): Promise<void> {
  const queue = visitQueue();
  if (queue.length === 0) return;
  if (!websiteSettings().statistics || !setupComplete()) {
    queue.length = 0;
    return;
  }
  const batch = queue.splice(0, queue.length);
  const { stats, visitors } = await collections();
  const expiresAt = inDays(KEEP_DAYS);

  // Neue Besucher des Tages: Einfügen klappt nur beim ersten Mal
  const newVisitors = new Map<string, number>();
  for (const visit of batch) {
    try {
      await visitors.insertOne({ _id: `${visit.day}:${visit.visitor}`, expiresAt: inDays(2) });
      newVisitors.set(visit.day, (newVisitors.get(visit.day) ?? 0) + 1);
    } catch {
      /* schon gezählt */
    }
  }

  const increments = new Map<string, { kind: Row["kind"]; day: string; key?: string; views: number; visitors: number }>();
  const add = (kind: Row["kind"], day: string, key: string | undefined, views: number, visitorCount = 0) => {
    const id = [kind, day, key].filter(Boolean).join("|");
    const entry = increments.get(id) ?? { kind, day, key, views: 0, visitors: 0 };
    entry.views += views;
    entry.visitors += visitorCount;
    increments.set(id, entry);
  };
  for (const visit of batch) {
    add("tag", visit.day, undefined, 1);
    add("seite", visit.day, visit.path, 1);
    if (visit.source) add("quelle", visit.day, visit.source, 1);
    add("geraet", visit.day, visit.device, 1);
  }
  for (const [day, count] of newVisitors) add("tag", day, undefined, 0, count);

  const operations: AnyBulkWriteOperation<Row>[] = [...increments].map(([id, entry]) => ({
    updateOne: {
      filter: { _id: id },
      update: {
        $inc: entry.kind === "tag" ? { views: entry.views, visitors: entry.visitors } : { views: entry.views },
        $set: { kind: entry.kind, day: entry.day, expiresAt, ...(entry.key ? { key: entry.key } : {}) },
      },
      upsert: true,
    },
  }));
  await stats.bulkWrite(operations, { ordered: false });
}

/* --------------------------------- Auswertung ----------------------------- */

export type DayRow = { day: string; views: number; visitors: number };
export type Ranked = { key: string; views: number };

export type StatisticsReport = {
  days: DayRow[];
  totals: { views: number; visitors: number };
  today: DayRow;
  pages: Ranked[];
  sources: Ranked[];
  devices: Ranked[];
};

const dayString = (date: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(date);

export async function statisticsReport(rangeDays: number): Promise<StatisticsReport> {
  const { stats } = await collections();
  const allDays = Array.from({ length: rangeDays }, (_, index) => dayString(new Date(Date.now() - (rangeDays - 1 - index) * 86_400_000)));
  const from = allDays[0];
  const rows = await stats.find({ day: { $gte: from } }).toArray();

  const byDay = new Map(rows.filter((row) => row.kind === "tag").map((row) => [row.day, row]));
  const days = allDays.map((day) => ({ day, views: byDay.get(day)?.views ?? 0, visitors: byDay.get(day)?.visitors ?? 0 }));

  const rank = (kind: Row["kind"], limit: number) => {
    const sums = new Map<string, number>();
    for (const row of rows) if (row.kind === kind && row.key) sums.set(row.key, (sums.get(row.key) ?? 0) + row.views);
    return [...sums]
      .map(([key, views]) => ({ key, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
  };

  return {
    days,
    totals: { views: days.reduce((sum, day) => sum + day.views, 0), visitors: days.reduce((sum, day) => sum + day.visitors, 0) },
    today: days[days.length - 1],
    pages: rank("seite", 10),
    sources: rank("quelle", 8),
    devices: rank("geraet", 3),
  };
}
