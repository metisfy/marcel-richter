import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Site } from "@/lib/content";

const LINK = "underline-offset-4 hover:text-fg hover:underline";

export async function SiteFooter({ site }: { site: Site }) {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const year = new Date().getFullYear();
  // Kommt als Build-Arg aus der Pipeline: zeigt, welcher Commit live ist.
  const version = (process.env.GIT_SHA ?? "dev").slice(0, 7);

  return (
    <footer className="mt-24 border-t-[3px] border-rule">
      <div className="container-page grid gap-8 py-10 text-sm text-muted sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="display text-2xl text-fg">{site.name}</p>
          <p className="mt-2">
            {[site.team.position, site.team.name, site.location].filter(Boolean).join(" · ")}
          </p>
        </div>

        {site.socials.length > 0 ? (
          <ul className="space-y-1.5">
            {site.socials.map((social) => (
              <li key={social.url}>
                <a href={social.url} rel="me noopener" className={LINK}>
                  {social.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-3">
          <nav aria-label={tNav("footer")}>
            <ul className="space-y-1.5">
              <li>
                <Link href="/kontakt" className={LINK}>
                  {tNav("contact")}
                </Link>
              </li>
              <li>
                <Link href="/impressum" className={LINK}>
                  {t("legal")}
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className={LINK}>
                  {t("privacy")}
                </Link>
              </li>
            </ul>
          </nav>
          <p>
            © {year}{" "}
            {site.copyright.length > 0
              ? site.copyright.map((holder, index) => (
                  <span key={holder.label}>
                    {index > 0 ? " · " : null}
                    {holder.url ? (
                      <a href={holder.url} rel="noopener" className={LINK}>
                        {holder.label}
                      </a>
                    ) : (
                      holder.label
                    )}
                  </span>
                ))
              : site.name}
          </p>
          <p className="font-mono text-xs">
            {t("version")} {version}
          </p>
        </div>
      </div>
    </footer>
  );
}
