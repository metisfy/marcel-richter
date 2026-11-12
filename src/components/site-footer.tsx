import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Site } from "@/lib/content";

export async function SiteFooter({ site }: { site: Site }) {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const year = new Date().getFullYear();
  // Kommt als Build-Arg aus der Pipeline: zeigt, welcher Commit live ist.
  const version = (process.env.GIT_SHA ?? "dev").slice(0, 7);

  return (
    <footer className="mt-24 border-t border-border">
      <div className="container-page grid gap-8 py-10 text-sm text-muted md:grid-cols-[1fr_auto] md:items-start">
        <div className="space-y-2">
          <p className="font-semibold text-fg">{site.name}</p>
          <p>
            © {year} {site.name}
            {site.location ? ` · ${site.location}` : null}
          </p>
          {site.socials.length > 0 ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {site.socials.map((social) => (
                <li key={social.url}>
                  <a href={social.url} rel="me noopener" className="underline-offset-4 hover:text-fg hover:underline">
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-3 md:text-right">
          <nav aria-label={tNav("footer")}>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 md:justify-end">
              <li>
                <Link href="/kontakt" className="underline-offset-4 hover:text-fg hover:underline">
                  {tNav("contact")}
                </Link>
              </li>
              <li>
                <Link href="/impressum" className="underline-offset-4 hover:text-fg hover:underline">
                  {t("legal")}
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className="underline-offset-4 hover:text-fg hover:underline">
                  {t("privacy")}
                </Link>
              </li>
            </ul>
          </nav>
          <p className="font-mono text-xs">
            {t("version")} {version}
          </p>
        </div>
      </div>
    </footer>
  );
}
