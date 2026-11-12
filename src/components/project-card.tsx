import Image from "next/image";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Project } from "@/lib/content";

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
    <article className="card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-subtle">
        <Image
          src={project.cover}
          alt={project.coverAlt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-sm text-muted">
          <time dateTime={project.date}>{year}</time>
          {project.role ? ` · ${project.role}` : null}
        </p>
        <Heading className="text-xl font-semibold tracking-tight">
          {/* Der Link überspannt per ::after die ganze Karte. */}
          <Link
            href={{ pathname: "/projekte/[slug]", params: { slug: project.slug } }}
            className="after:absolute after:inset-0 after:content-['']"
            lang={project.contentLocale !== locale ? project.contentLocale : undefined}
          >
            {project.title}
          </Link>
        </Heading>
        <p className="text-muted">{project.summary}</p>
        {project.tags.length > 0 ? (
          <ul className="mt-auto flex flex-wrap gap-2 pt-2">
            {project.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-fg">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
