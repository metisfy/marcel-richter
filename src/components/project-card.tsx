import Image from "next/image";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Project } from "@/lib/content";

/** „● Live“ (grün, pulsierend) bzw. „● In Aufbau“ (violett) */
export function StatusLabel({ status, className = "" }: { status: string; className?: string }) {
  const live = /^live$/i.test(status.trim());
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span aria-hidden="true" className={live ? "live-dot" : "inline-block size-[7px] rounded-full bg-accent-2"} />
      {status}
    </span>
  );
}

/** Projektkarte wie die Karten auf metisone.de: Bild oben, Text darunter. */
export function ProjectCard({
  project,
  locale,
  headingLevel = "h2",
  eager = false,
}: {
  project: Project;
  locale: Locale;
  headingLevel?: "h2" | "h3";
  /** Bild sofort und bevorzugt laden (erstes, sichtbares Bild = Largest Contentful Paint) */
  eager?: boolean;
}) {
  const Heading = headingLevel;
  const year = project.date.slice(0, 4);

  return (
    <article className="card group relative flex flex-col overflow-hidden transition-[transform,box-shadow] duration-300 hover:-translate-y-[3px] hover:shadow-soft">
      <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-surface">
        <Image
          src={project.cover}
          alt={project.coverAlt}
          fill
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {project.status ? (
          <StatusLabel
            status={project.status}
            className="absolute top-3 left-3 rounded-full border border-line bg-bg/90 px-2.5 py-1 font-mono text-[11px] font-medium backdrop-blur"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-6" lang={project.contentLocale !== locale ? project.contentLocale : undefined}>
        <p className="eyebrow">
          <time dateTime={project.date}>{year}</time>
          {project.role ? ` · ${project.role}` : null}
        </p>
        <Heading className="mt-3 text-lg leading-snug font-semibold tracking-[-0.01em]">
          {/* Der Link überspannt per ::after die ganze Karte. */}
          <Link
            href={{ pathname: "/projekte/[slug]", params: { slug: project.slug } }}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {project.title}
          </Link>
        </Heading>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{project.summary}</p>
        {project.tags.length > 0 ? (
          <ul className="mt-auto flex flex-wrap gap-1.5 pt-5">
            {project.tags.map((tag) => (
              <li key={tag} className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[11.5px] text-muted">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
