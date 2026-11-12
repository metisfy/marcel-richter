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
        {number ?? parts[0]?.[0]}
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
