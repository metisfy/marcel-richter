import Image from "next/image";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Project } from "@/lib/content";

/** Projektkarte wie die Karten auf metisone.de: Bild oben, Text darunter. */
export function ProjectCard({
  project,
  locale,
  headingLevel = "h2",
  priority = false,
}: {
  project: Project;
  locale: Locale;
  headingLevel?: "h2" | "h3";
  priority?: boolean;
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
          priority={priority}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
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
