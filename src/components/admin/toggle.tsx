"use client";

import { useOptimistic, useState, useTransition } from "react";

/**
 * Regler (Schalter) für eine Server-Aktion: springt sofort um, die Aktion
 * läuft im Hintergrund. Schlägt sie fehl, springt er zurück und sagt es.
 */
export function Toggle({
  checked,
  action,
  label,
  onText = "an",
  offText = "aus",
}: {
  checked: boolean;
  action: (value: boolean) => Promise<void>;
  /** Barrierefreier Name, z. B. „metisCode auf der Website zeigen“ */
  label: string;
  onText?: string;
  offText?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const toggle = () =>
    startTransition(async () => {
      const next = !optimistic;
      setError(false);
      setOptimistic(next);
      try {
        await action(next);
      } catch {
        setError(true);
      }
    });

  return (
    <span className="inline-flex shrink-0 items-center gap-2.5">
      <span className={`font-mono text-[11.5px] ${error ? "text-loss" : "text-muted"}`} aria-hidden="true">
        {error ? "Fehler" : optimistic ? onText : offText}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label={label}
        aria-busy={pending}
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${optimistic ? "bg-accent" : "bg-surface-2 ring-1 ring-line ring-inset"} ${pending ? "opacity-70" : ""}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform ${optimistic ? "translate-x-5" : ""}`}
        />
      </button>
    </span>
  );
}
