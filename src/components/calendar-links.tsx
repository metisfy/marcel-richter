"use client";

import { useSyncExternalStore } from "react";

import { CalendarIcon } from "./icons";

const subscribe = () => () => {};

/**
 * „Kalender abonnieren“: webcal-Link (Apple-Kalender, Outlook, Thunderbird),
 * Google Kalender und die .ics-Datei zum Herunterladen. Die Adressen werden im
 * Browser aus der aktuellen Domain gebaut – so funktionieren sie auch, bevor
 * SITE_URL gesetzt ist, und intern über die IP-Adresse.
 */
export function CalendarLinks({
  path,
  labels,
}: {
  path: string;
  labels: { title: string; text: string; subscribe: string; google: string; download: string };
}) {
  // Auf dem Server (und beim ersten Rendern) nur der relative Pfad
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const webcal = origin ? `${origin.replace(/^https?:/, "webcal:")}${path}` : path;
  const google = origin ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}` : undefined;

  return (
    <div className="card mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-5 sm:p-6" data-reveal>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <CalendarIcon width={18} height={18} />
        </span>
        <div>
          <p className="font-semibold">{labels.title}</p>
          <p className="text-sm text-muted">{labels.text}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={webcal} className="btn btn-primary btn-nav">
          {labels.subscribe}
        </a>
        {google ? (
          <a href={google} rel="noopener" className="btn btn-ghost btn-nav">
            {labels.google}
          </a>
        ) : null}
        <a href={path} download className="btn btn-ghost btn-nav">
          {labels.download}
        </a>
      </div>
    </div>
  );
}
