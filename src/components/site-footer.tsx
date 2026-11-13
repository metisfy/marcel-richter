import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Site } from "@/lib/content";

import { Brand } from "./brand";

const LINK = "text-[14.5px] text-muted transition-colors hover:text-fg";

export async function SiteFooter({ site }: { site: Site }) {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");
  const year = new Date().getFullYear();
  // Kommt als Build-Arg aus der Pipeline: zeigt, welcher Commit live ist.
  const version = (process.env.GIT_SHA ?? "dev").slice(0, 7);

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="container-page pt-16 pb-9">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]" data-reveal-stagger>
          <div className="max-w-xs">
            <Brand name={site.name} number={site.team.number} />
            <p className="mt-4 text-[14.5px] leading-relaxed text-muted">{site.tagline}</p>
          </div>

          <nav aria-label={t("navigation")}>
            <p className="eyebrow">{t("navigation")}</p>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/ueber-mich" className={LINK}>{tNav("about")}</Link></li>
              <li><Link href="/projekte" className={LINK}>{tNav("projects")}</Link></li>
              <li><Link href="/saison" className={LINK}>{tNav("season")}</Link></li>
            </ul>
          </nav>

          {site.socials.length > 0 ? (
            <div>
              <p className="eyebrow">{t("profiles")}</p>
              <ul className="mt-4 space-y-2.5">
                {site.socials.map((social) => (
                  <li key={social.url}>
                    <a href={social.url} rel="me noopener" className={LINK}>
                      {social.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <nav aria-label={tNav("footer")}>
            <p className="eyebrow">{t("legalHeading")}</p>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/kontakt" className={LINK}>{tNav("contact")}</Link></li>
              <li><Link href="/impressum" className={LINK}>{t("legal")}</Link></li>
              <li><Link href="/datenschutz" className={LINK}>{t("privacy")}</Link></li>
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-7 text-sm text-muted">
          <p>
            © {year}{" "}
            {site.copyright.length > 0
              ? site.copyright.map((holder, index) => (
                  <span key={holder.label}>
                    {index > 0 ? " · " : null}
                    {holder.url ? (
                      <a href={holder.url} rel="noopener" className="transition-colors hover:text-fg">
                        {holder.label}
                      </a>
                    ) : (
                      holder.label
                    )}
                  </span>
                ))
              : site.name}
          </p>
          <p className="font-mono text-[12.5px]">
            {t("version")} {version} · Made in Germany
          </p>
        </div>
      </div>
    </footer>
  );
}
