import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { ExternalIcon, MailIcon } from "@/components/icons";
import { PageIntro } from "@/components/page-intro";
import { initLocale, type LocaleParams } from "@/i18n/locale";
import { getSite } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const t = await getTranslations({ locale, namespace: "contact" });
  return pageMetadata({
    locale,
    href: "/kontakt",
    title: t("title"),
    description: t("description"),
    ogKey: "kontakt",
    siteName: getSite(locale).name,
  });
}

export default async function ContactPage({ params }: LocaleParams) {
  const locale = await initLocale(params);
  const t = await getTranslations("contact");
  const site = getSite(locale);

  return (
    <div className="container-page">
      <PageIntro title={t("title")} lead={t("lead")} />

      <div className="grid gap-6 md:grid-cols-3">
        <section aria-labelledby="kontakt-mail" className="card p-6 md:col-span-2">
          <h2 id="kontakt-mail" className="text-sm font-semibold text-muted">
            {t("email")}
          </h2>
          <a
            href={`mailto:${site.email}`}
            className="mt-3 inline-flex items-center gap-3 text-2xl font-semibold tracking-tight break-all text-accent underline-offset-4 hover:underline sm:text-3xl"
          >
            <MailIcon width={28} height={28} className="shrink-0" />
            {site.email}
          </a>

          {site.socials.length > 0 ? (
            <>
              <h2 className="mt-10 text-sm font-semibold text-muted">{t("profiles")}</h2>
              <ul className="mt-3 flex flex-wrap gap-3">
                {site.socials.map((social) => (
                  <li key={social.url}>
                    <a href={social.url} rel="me noopener" className="btn btn-secondary">
                      {social.label}
                      <ExternalIcon width={16} height={16} />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section aria-labelledby="kontakt-verein" className="card p-6">
          <h2 id="kontakt-verein" className="text-sm font-semibold text-muted">
            {t("team")}
          </h2>
          <div className="mt-4 flex items-center gap-4">
            {site.team.logo ? (
              <Image src={site.team.logo} alt="" width={56} height={56} className="size-14 shrink-0" />
            ) : null}
            <div>
              <p className="font-semibold">{site.team.name}</p>
              <p className="text-sm text-muted">
                {[site.team.sport, site.team.league].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          {site.team.position || site.team.number ? (
            <p className="mt-4 text-sm text-muted">
              {[site.team.position, site.team.number ? `#${site.team.number}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {site.team.url ? (
            <a href={site.team.url} rel="noopener" className="text-link mt-6 inline-flex items-center gap-1.5 text-sm">
              {t("teamLink")}
              <ExternalIcon width={14} height={14} />
            </a>
          ) : null}
        </section>
      </div>
    </div>
  );
}
