/** „Marcel Richter“ → „MR“ */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}

/**
 * Schriftzug wie bei metisOne: Marke als blaues Quadrat (hier mit der
 * Rückennummer), Vorname dunkel, Nachname blau.
 */
export function Brand({ name, number, className = "" }: { name: string; number?: number; className?: string }) {
  const parts = name.split(" ");
  const last = parts.length > 1 ? parts.pop() : undefined;
  return (
    <span className={`inline-flex items-center gap-2.5 text-lg font-semibold tracking-[-0.01em] text-fg ${className}`}>
      <span aria-hidden="true" className="brand-mark">
        {number ?? initials(name)}
      </span>
      <span>
        {parts.join(" ")}
        {last ? (
          <>
            {" "}
            <span className="text-accent">{last}</span>
          </>
        ) : null}
      </span>
    </span>
  );
}
