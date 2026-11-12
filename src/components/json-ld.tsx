/** Bettet strukturierte Daten (schema.org) als JSON-LD ein. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // "<" escapen, damit Inhalte das <script> nicht vorzeitig schließen.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
