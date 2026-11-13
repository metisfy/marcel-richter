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
    <div className="max-w-3xl pt-14 pb-12 sm:pt-20">
      {eyebrow ? <p className="eyebrow rise mb-4">{eyebrow}</p> : null}
      <h1 className="rise-focus text-[clamp(2rem,1.4rem+2.6vw,3rem)] leading-[1.08] font-semibold tracking-[-0.02em] text-balance [--delay:0.06s]">
        {title}
      </h1>
      {lead ? <p className="rise mt-5 text-lg leading-relaxed text-pretty text-muted [--delay:0.14s]">{lead}</p> : null}
      {children ? <div className="rise [--delay:0.22s]">{children}</div> : null}
    </div>
  );
}

export function OnlyGermanNote({ text }: { text: string }) {
  return <p className="mb-8 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">{text}</p>;
}

/** Abschnittskopf wie auf metisone.de: Mono-Beschriftung, Überschrift, optional Link rechts. */
export function SectionHead({
  eyebrow,
  title,
  id,
  action,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  id?: string;
  action?: ReactNode;
  center?: boolean;
}) {
  return (
    <div data-reveal className={`mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 ${center ? "flex-col items-center text-center" : ""}`}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-3.5">{eyebrow}</p> : null}
        <h2 id={id} className="h2">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
