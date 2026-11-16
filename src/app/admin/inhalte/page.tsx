import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/shell";
import { Badge, InfoList, PageHead, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { ANALYTICS } from "@/lib/analytics";
import { getPage, getProjects } from "@/lib/content";
import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";

export const metadata: Metadata = { title: "Inhalte & SEO" };

export default async function ContentPage() {
  const admin = await requireAdmin("/inhalte");
  const site = SITE_URL_CONFIGURED ? SITE_URL : "";
  const projects = getProjects("de");
  const pages = (["ueber-mich", "impressum", "datenschutz"] as const).map((name) => ({ name, title: getPage(name, "de").title }));
  const google = Boolean(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION);
  const bing = Boolean(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION);

  return (
    <AdminShell admin={admin}>
      <PageHead title="Inhalte & SEO" text="Was auf der Website steht und wie Suchmaschinen sie sehen." />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Projekte" text="content/projekte/<name>/de.mdx (+ en.mdx)" action={<Badge tone="accent">{projects.length}</Badge>}>
            <ul className="divide-y divide-line">
              {projects.map((project) => (
                <li key={project.slug}>
                  <a
                    href={`${site}/projekte/${project.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-surface"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{project.title}</span>
                      <span className="block truncate text-sm text-muted">{project.summary}</span>
                    </span>
                    {project.status ? <Badge tone="neutral">{project.status}</Badge> : null}
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel id="seo" title="Suchmaschinen" text="Gesteuert über GitHub-Variablen (siehe README).">
            <InfoList
              rows={[
                { label: "Domain", value: SITE_URL_CONFIGURED ? SITE_URL.replace(/^https?:\/\//, "") : <Badge tone="warn">nicht gesetzt</Badge> },
                {
                  label: "Indexierung",
                  value: SITE_URL_CONFIGURED ? <Badge tone="good">freigegeben</Badge> : <Badge tone="warn">gesperrt (noindex)</Badge>,
                },
                { label: "Google Search Console", value: google ? <Badge tone="good">verknüpft</Badge> : <Badge tone="neutral">nicht verknüpft</Badge> },
                { label: "Bing Webmaster Tools", value: bing ? <Badge tone="good">verknüpft</Badge> : <Badge tone="neutral">nicht verknüpft</Badge> },
                { label: "Besucherstatistik", value: ANALYTICS ? <Badge tone="good">an (Umami)</Badge> : <Badge tone="neutral">aus</Badge> },
              ]}
            />
            <div className="mt-5 flex flex-wrap gap-2.5">
              <a href={`${site}/sitemap.xml`} target="_blank" rel="noopener" className="btn btn-ghost btn-nav">
                Sitemap
              </a>
              <a href={`${site}/robots.txt`} target="_blank" rel="noopener" className="btn btn-ghost btn-nav">
                robots.txt
              </a>
            </div>
          </Panel>

          <Panel title="Seiten" text="content/seiten/ und content/site.yaml">
            <ul className="divide-y divide-line">
              {pages.map((page) => (
                <li key={page.name}>
                  <a href={`${site}/${page.name}`} target="_blank" rel="noopener" className="-mx-2 flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-surface">
                    <span className="font-medium">{page.title}</span>
                    <span className="font-mono text-[12px] text-muted">/{page.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Inhalte ändern">
            <ol className="list-decimal space-y-1.5 pl-5 text-[15px]">
              <li>Datei unter <code className="font-mono text-[13px]">content/</code> im Repository bearbeiten.</li>
              <li>Committen und auf <code className="font-mono text-[13px]">main</code> pushen.</li>
              <li>GitHub baut das Image, der Server rollt es aus – nach etwa 10 Minuten ist es live.</li>
            </ol>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
