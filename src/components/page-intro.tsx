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
    <div className="pt-10 pb-10 sm:pt-16 sm:pb-12">
      {eyebrow ? <p className="mb-4 text-sm font-medium text-muted">{eyebrow}</p> : null}
      <h1 className="display text-[clamp(3rem,9vw,6.5rem)] text-balance">{title}</h1>
      {lead ? <p className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted">{lead}</p> : null}
      {children}
    </div>
  );
}

export function OnlyGermanNote({ text }: { text: string }) {
  return <p className="mb-8 border-l-[3px] border-signal bg-subtle px-4 py-3 text-sm">{text}</p>;
}
