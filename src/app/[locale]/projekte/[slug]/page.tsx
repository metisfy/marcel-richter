import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BrowserFrame } from "@/components/browser-frame";
import { StatusLabel } from "@/components/project-card";
import { ArrowLeftIcon, ExternalIcon } from "@/components/icons";
import { JsonLd } from "@/components/json-ld";
import { MdxContent } from "@/components/mdx-content";
import { OnlyGermanNote } from "@/components/page-intro";
import { initLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getProject, getProjects, getSite } from "@/lib/content";
import { formatProjectDate } from "@/lib/format";
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

      <nav aria-label={tNav("breadcrumb")} className="pt-12 text-sm">
        <Link href="/projekte" className="inline-flex items-center gap-1.5 font-medium text-muted hover:text-fg">
          <ArrowLeftIcon width={16} height={16} />
          {t("back")}
        </Link>
      </nav>

      <header className="max-w-3xl pt-8 pb-10" lang={fallback ? project.contentLocale : undefined}>
        <p className="eyebrow rise mb-4">
          {project.date.slice(0, 4)}
          {project.role ? ` · ${project.role}` : null}
        </p>
        <h1 className="rise-focus text-[clamp(2rem,1.4rem+2.6vw,3rem)] leading-[1.08] font-semibold tracking-[-0.02em] text-balance [--delay:0.06s]">
          {project.title}
        </h1>
        <p className="rise mt-5 text-lg leading-relaxed text-pretty text-muted [--delay:0.14s]">{project.summary}</p>
      </header>

      <div className="rise card relative mb-12 aspect-[16/9] overflow-hidden bg-surface shadow-soft [--delay:0.22s]">
        <Image
          src={project.cover}
          alt={project.coverAlt}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(min-width: 1152px) 1104px, 100vw"
          className="object-cover object-top"
        />
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_17rem]">
        <div>
          {fallback ? <OnlyGermanNote text={tLanguage("onlyGerman")} /> : null}
          <MdxContent source={project.body} lang={fallback ? project.contentLocale : undefined} />
          {/* Die ganze Seite läuft im Browserfenster durch – bewusst unterhalb
              des Texts, damit das lange Bild das Laden der Seite nicht bremst. */}
          {project.screenshot ? (
            <section aria-labelledby="ganze-seite" className="mt-12" data-reveal>
              <h2 id="ganze-seite" className="eyebrow mb-4">
                {t("fullPage")}
              </h2>
              <BrowserFrame src={project.screenshot} alt={project.coverAlt} url={project.links[0]?.url} />
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <dl data-reveal="right" className="card divide-y divide-line text-[15px]">
            <div className="p-5">
              <dt className="eyebrow">{t("date")}</dt>
              <dd className="mt-1">
                <time dateTime={project.date}>{formatProjectDate(project.date, locale)}</time>
              </dd>
            </div>
            {project.role ? (
              <div className="p-5">
                <dt className="eyebrow">{t("role")}</dt>
                <dd className="mt-1 font-medium">{project.role}</dd>
              </div>
            ) : null}
            {project.client ? (
              <div className="p-5">
                <dt className="eyebrow">{t("client")}</dt>
                <dd className="mt-1">{project.client}</dd>
              </div>
            ) : null}
            {project.status ? (
              <div className="p-5">
                <dt className="eyebrow">{t("status")}</dt>
                <dd className="mt-1">
                  <StatusLabel status={project.status} />
                </dd>
              </div>
            ) : null}
            {project.company ? (
              <div className="p-5">
                <dt className="eyebrow">{t("company")}</dt>
                <dd className="mt-1">{project.company}</dd>
              </div>
            ) : null}
            {project.tags.length > 0 ? (
              <div className="p-5">
                <dt className="eyebrow">{t("tags")}</dt>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span key={tag} className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[11.5px] text-muted">
                      {tag}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
            {project.links.length > 0 ? (
              <div className="p-5">
                <dt className="eyebrow">{t("links")}</dt>
                <dd className="mt-1">
                  <ul className="space-y-1">
                    {project.links.map((link) => (
                      <li key={link.url}>
                        <a href={link.url} className="inline-flex items-center gap-1.5 font-medium text-accent" rel="noopener">
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
