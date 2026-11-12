import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ArrowLeftIcon, ExternalIcon } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { MdxContent } from "@/components/mdx-content";
import { OnlyGermanNote } from "@/components/page-intro";
import { initLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getProject, getProjects, getSite } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";
import { projectGraph } from "@/lib/structured-data";

type Props = { params: Promise<{ locale: string; slug: string }> };

// Nur Projekte, die beim Build existieren – alles andere ist 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getProjects(locale).map((project) => ({ locale, slug: project.slug })),
  );
}

export async function generateMetadata({ params }: Props) {
  const locale = await initLocale(params);
  const { slug } = await params;
  const project = getProject(locale, slug);
  if (!project) return {};
  return pageMetadata({
    locale,
    href: { pathname: "/projekte/[slug]", params: { slug } },
    title: project.title,
    description: project.summary,
    ogKey: `projekt-${slug}`,
    siteName: getSite(locale).name,
    type: "article",
  });
}

export default async function ProjectPage({ params }: Props) {
  const locale = await initLocale(params);
  const { slug } = await params;
  const project = getProject(locale, slug);
  if (!project) notFound();

  const t = await getTranslations("projects");
  const tNav = await getTranslations("nav");
  const tLanguage = await getTranslations("language");
  const fallback = project.contentLocale !== locale;

  return (
    <article className="container-page">
      <JsonLd data={projectGraph(project, locale, { home: tNav("home"), projects: tNav("projects") })} />

      <nav aria-label={tNav("breadcrumb")} className="pt-10 text-sm">
        <Link href="/projekte" className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
          <ArrowLeftIcon width={16} height={16} />
          {t("back")}
        </Link>
      </nav>

      <header className="max-w-3xl pt-6 pb-10" lang={fallback ? project.contentLocale : undefined}>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{project.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-pretty text-muted">{project.summary}</p>
      </header>

      <div className="relative mb-12 aspect-[16/9] overflow-hidden rounded-2xl bg-subtle">
        <Image
          src={project.cover}
          alt={project.coverAlt}
          fill
          priority
          sizes="(min-width: 1152px) 1104px, 100vw"
          className="object-cover"
        />
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_16rem]">
        <div>
          {fallback ? <OnlyGermanNote text={tLanguage("onlyGerman")} /> : null}
          <MdxContent source={project.body} lang={fallback ? project.contentLocale : undefined} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <dl className="card divide-y divide-border text-sm">
            <div className="p-4">
              <dt className="font-semibold text-muted">{t("date")}</dt>
              <dd className="mt-1">
                <time dateTime={project.date}>{formatDate(project.date, locale, { time: false })}</time>
              </dd>
            </div>
            {project.role ? (
              <div className="p-4">
                <dt className="font-semibold text-muted">{t("role")}</dt>
                <dd className="mt-1">{project.role}</dd>
              </div>
            ) : null}
            {project.tags.length > 0 ? (
              <div className="p-4">
                <dt className="font-semibold text-muted">{t("tags")}</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-fg">
                      {tag}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {project.links.length > 0 ? (
              <div className="p-4">
                <dt className="font-semibold text-muted">{t("links")}</dt>
                <dd className="mt-1">
                  <ul className="space-y-1">
                    {project.links.map((link) => (
                      <li key={link.url}>
                        <a href={link.url} className="text-link inline-flex items-center gap-1.5" rel="noopener">
                          {link.label}
                          <ExternalIcon width={14} height={14} />
                        </a>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>
    </article>
  );
}
