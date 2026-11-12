import Image from "next/image";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Project } from "@/lib/content";

/**
 * Ein Projekt als Zeile: Jahr | Titel, Kurzbeschreibung, Rolle | Bild.
 * Der Titel-Link überspannt per ::after die ganze Zeile.
 */
export function ProjectRow({
  project,
  locale,
  headingLevel = "h2",
  size = "md",
  priority = false,
}: {
  project: Project;
  locale: Locale;
  headingLevel?: "h2" | "h3";
  size?: "md" | "lg";
  priority?: boolean;
}) {
  const Heading = headingLevel;
  const year = project.date.slice(0, 4);
  const columns =
    size === "lg"
      ? "grid-cols-[1fr_7rem] sm:grid-cols-[5rem_1fr_15rem] lg:grid-cols-[6rem_1fr_22rem]"
      : "grid-cols-[1fr_6rem] sm:grid-cols-[5rem_1fr_11rem]";

  return (
    <article className={`group relative grid items-start gap-x-5 gap-y-3 border-b border-border py-6 sm:gap-x-8 ${columns}`}>
      <p className="display hidden pt-1 text-3xl text-muted tabular-nums sm:block">
        <time dateTime={project.date}>{year}</time>
      </p>
      <div lang={project.contentLocale !== locale ? project.contentLocale : undefined}>
        <Heading className="condensed text-2xl leading-tight sm:text-[1.75rem]">
          <Link
            href={{ pathname: "/projekte/[slug]", params: { slug: project.slug } }}
            className="decoration-signal decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
          >
            {project.title}
          </Link>
        </Heading>
        <p className="mt-2 max-w-xl text-pretty text-muted">{project.summary}</p>
        <p className="mt-3 text-sm">
          <span className="sm:hidden">{year} · </span>
          {[project.role, project.tags.join(", ")].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="relative aspect-[4/3] overflow-hidden bg-subtle">
        <Image
          src={project.cover}
          alt={project.coverAlt}
          fill
          priority={priority}
          sizes={size === "lg" ? "(min-width: 1024px) 352px, (min-width: 640px) 240px, 112px" : "(min-width: 640px) 176px, 96px"}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </div>
    </article>
  );
}
