import type { ReactNode } from "react";

export function PageIntro({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-3xl pt-12 pb-10 sm:pt-16">
      {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
      <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{title}</h1>
      {lead ? <p className="mt-4 text-lg leading-relaxed text-pretty text-muted">{lead}</p> : null}
      {children}
    </div>
  );
}

export function OnlyGermanNote({ text }: { text: string }) {
  return (
    <p className="mb-8 rounded-lg border border-border bg-subtle px-4 py-3 text-sm text-muted">{text}</p>
  );
}
