import Link from "next/link";
import type { ReactNode } from "react";

import { AdminIcon, type AdminIconName } from "./icons";

/*
 * Kleine Anzeige-Bausteine des Admin-Bereichs (nach t-orga: Seitenkopf,
 * Kennzahl, Plakette, Kachel, Karte). Rein darstellend, ohne Server-APIs –
 * auch aus Client-Komponenten nutzbar.
 */

export function PageHead({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.5rem,1.25rem+1vw,2rem)] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
        {text ? <p className="mt-1.5 text-[15px] text-muted">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

export type BadgeTone = "good" | "warn" | "bad" | "neutral" | "accent";

const BADGE: Record<BadgeTone, string> = {
  good: "bg-win-soft text-win",
  warn: "bg-[color-mix(in_srgb,#d97706_14%,transparent)] text-[#b45309] dark:text-[#fbbf24]",
  bad: "bg-loss-soft text-loss",
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 font-mono text-[11.5px] font-medium whitespace-nowrap ${BADGE[tone]}`}>
      {children}
    </span>
  );
}

/** Kennzahl-Kachel; mit `href` führt die ganze Kachel dorthin, wo die Zahl herkommt. */
export function StatTile({
  icon,
  value,
  label,
  hint,
  href,
}: {
  icon: AdminIconName;
  value: ReactNode;
  label: string;
  hint?: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <AdminIcon name={icon} />
      </span>
      <div className="min-w-0">
        <div className="text-[1.75rem] leading-none font-semibold tracking-[-0.02em] tabular-nums">{value}</div>
        <div className="mt-2 text-sm font-medium">{label}</div>
        {hint ? <div className="mt-0.5 truncate text-xs text-muted">{hint}</div> : null}
      </div>
    </>
  );
  const className = "card flex items-start gap-4 px-5 py-5";
  return href ? (
    <Link href={href} className={`${className} transition-[border-color,translate] hover:-translate-y-0.5 hover:border-accent/40`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** Kachel der Einstellungs-Übersicht: führt zu einer Unterseite, Stand auf einen Blick. */
export function SettingsTile({
  href,
  icon,
  title,
  text,
  status,
}: {
  href: string;
  icon: AdminIconName;
  title: string;
  text: string;
  status: ReactNode;
}) {
  return (
    <Link href={href} className="card flex items-start gap-4 px-5 py-5 transition-[border-color,translate] hover:-translate-y-0.5 hover:border-accent/40">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <AdminIcon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{title}</h2>
          {status}
        </div>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </Link>
  );
}

/** Karte mit Überschrift und optionaler Aktion rechts. */
export function Panel({
  id,
  title,
  text,
  action,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  text?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-titel` : undefined} className={`card scroll-mt-24 p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id ? `${id}-titel` : undefined} className="text-[17px] font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {text ? <p className="mt-1 text-sm text-muted">{text}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Zeilen „Bezeichnung – Wert“ mit Trennlinien */
export function InfoList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line border-y border-line text-[15px]">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
          <dt className="text-muted">{row.label}</dt>
          <dd className="min-w-0 text-right font-medium break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const formatDateTime = (value?: string | Date | null) =>
  value
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value))
    : "–";
