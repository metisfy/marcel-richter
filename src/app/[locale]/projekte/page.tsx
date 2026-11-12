import { getTranslations } from "next-intl/server";

import { PageIntro } from "@/components/page-intro";
import { ProjectRow } from "@/components/project-card";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { getProjects, getSite } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const t = await getTranslations({ locale, namespace: "projects" });
  return pageMetadata({
    locale,
    href: "/projekte",
    title: t("title"),
    description: t("description"),
    ogKey: "projekte",
    siteName: getSite(locale).name,
  });
}

export default async function ProjectsPage({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const t = await getTranslations("projects");
  const projects = getProjects(locale);

  return (
    <div className="container-page">
      <PageIntro title={t("title")} lead={t("lead")} />
      {projects.length > 0 ? (
        <div className="border-t-[3px] border-rule">
          {projects.map((project, index) => (
            <ProjectRow key={project.slug} project={project} locale={locale} size="lg" priority={index < 2} />
          ))}
        </div>
      ) : (
        <p className="text-muted">{t("empty")}</p>
      )}
    </div>
  );
}
