import type { Metadata } from "next";
import Link from "next/link";

import { setIndexing, setProjectVisible } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/shell";
import { Toggle } from "@/components/admin/toggle";
import { Badge, InfoList, PageHead, Panel } from "@/components/admin/ui";
import { adminPrefix, requireAdmin } from "@/lib/admin/guard";
import { getPage, getProjects } from "@/lib/content";
import { SITE_HOST, SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";
import { websiteSettings } from "@/lib/website-settings";

export const metadata: Metadata = { title: "Inhalte & SEO" };

export default async function ContentPage() {
  const admin = await requireAdmin("/inhalte");
  const prefix = await adminPrefix();
  const settings = websiteSettings();
  const projects = getProjects("de");
  const visibleCount = projects.filter((project) => !settings.hiddenProjects.includes(project.slug)).length;
  const pages = (["ueber-mich", "impressum", "datenschutz"] as const).map((name) => ({ name, title: getPage(name, "de").title }));
  const google = Boolean(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION);
  const bing = Boolean(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION);
  const indexed = SITE_URL_CONFIGURED && settings.indexing;

  return (
    <AdminShell admin={admin}>
      <PageHead title="Inhalte & SEO" text={`Was auf ${SITE_HOST} steht und wie Suchmaschinen die Seite sehen.`} />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel
            title="Projekte"
            text="Mit dem Regler steuerst du, ob ein Projekt auf der Website erscheint. Versteckte Projekte fehlen in Listen und Sitemap, ihre Seite gibt 404."
            action={
              <Badge tone="accent">
                {visibleCount} von {projects.length} sichtbar
              </Badge>
            }
          >
            <ul className="divide-y divide-line">
              {projects.map((project) => {
                const visible = !settings.hiddenProjects.includes(project.slug);
                return (
                  <li key={project.slug} className="flex items-center justify-between gap-4 py-3">
                    <a
                      href={`${SITE_URL}/projekte/${project.slug}`}
                      target="_blank"
                      rel="noopener"
                      className={`group min-w-0 ${visible ? "" : "opacity-55"}`}
                      title={visible ? "Auf der Website öffnen" : "Versteckt – auf der Website nicht erreichbar"}
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium group-hover:text-accent">{project.title}</span>
                        {project.status ? <Badge tone="neutral">{project.status}</Badge> : null}
                      </span>
                      <span className="block truncate text-sm text-muted">{project.summary}</span>
                    </a>
                    <Toggle
                      checked={visible}
                      action={setProjectVisible.bind(null, project.slug)}
                      label={`${project.title} auf der Website zeigen`}
                      onText="sichtbar"
                      offText="versteckt"
                    />
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-sm text-muted">
              Texte und Bilder pflegst du im Repository unter <code className="font-mono text-[13px]">content/projekte/</code>.
            </p>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel
            id="seo"
            title="Suchmaschinen"
            text="Regler aus: robots.txt sperrt alles, jede Seite trägt noindex – Google & Co. nehmen sie nicht auf."
            action={
              <Toggle checked={settings.indexing} action={setIndexing} label="Website bei Suchmaschinen anzeigen" onText="öffentlich" offText="gesperrt" />
            }
          >
            <InfoList
              rows={[
                { label: "Domain", value: SITE_HOST },
                { label: "Indexierung", value: indexed ? <Badge tone="good">freigegeben</Badge> : <Badge tone="warn">gesperrt (noindex)</Badge> },
                { label: "Google Search Console", value: google ? <Badge tone="good">verknüpft</Badge> : <Badge tone="neutral">nicht verknüpft</Badge> },
                { label: "Bing Webmaster Tools", value: bing ? <Badge tone="good">verknüpft</Badge> : <Badge tone="neutral">nicht verknüpft</Badge> },
                {
                  label: "Besucherstatistik",
                  value: (
                    <Link href={`${prefix}/besucher`} className="hover:underline">
                      {settings.statistics ? <Badge tone="good">an</Badge> : <Badge tone="neutral">aus</Badge>}
                    </Link>
                  ),
                },
              ]}
            />
            <div className="mt-5 flex flex-wrap gap-2.5">
              <a href={`${SITE_URL}/sitemap.xml`} target="_blank" rel="noopener" className="btn btn-ghost btn-nav">
                Sitemap
              </a>
              <a href={`${SITE_URL}/robots.txt`} target="_blank" rel="noopener" className="btn btn-ghost btn-nav">
                robots.txt
              </a>
              <a href={SITE_URL} target="_blank" rel="noopener" className="btn btn-ghost btn-nav">
                Website öffnen
              </a>
            </div>
            {!google ? (
              <p className="mt-4 text-sm text-muted">
                Für die Google Search Console: Eigenschaft für {SITE_HOST} anlegen, Code als GitHub-Variable{" "}
                <code className="font-mono text-[13px]">GOOGLE_SITE_VERIFICATION</code> eintragen, danach die Sitemap einreichen.
              </p>
            ) : null}
          </Panel>

          <Panel title="Seiten" text="content/seiten/ und content/site.yaml">
            <ul className="divide-y divide-line">
              {pages.map((page) => (
                <li key={page.name}>
                  <a
                    href={`${SITE_URL}/${page.name}`}
                    target="_blank"
                    rel="noopener"
                    className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-surface"
                  >
                    <span className="font-medium">{page.title}</span>
                    <span className="font-mono text-[12px] text-muted">/{page.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
