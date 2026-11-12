import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { ExternalIcon } from "@/components/icons";
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
  const tPlayer = await getTranslations("player");
  const site = getSite(locale);

  const clubFacts = [
    { label: tPlayer("league"), value: site.team.league },
    { label: tPlayer("position"), value: site.team.position },
    { label: tPlayer("number"), value: site.team.number?.toString() },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <div className="container-page">
      <PageIntro title={t("title")} lead={t("lead")} />

      <div className="grid gap-x-12 gap-y-14 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="kontakt-mail">
          <div className="section-head">
            <h2 id="kontakt-mail" className="label">
              {t("email")}
            </h2>
          </div>
          <a
            href={`mailto:${site.email}`}
            className="condensed inline-block text-[clamp(2rem,5.5vw,3.75rem)] leading-none break-all underline decoration-signal decoration-[3px] underline-offset-[0.12em] hover:text-accent"
          >
            {site.email}
          </a>

          {site.socials.length > 0 ? (
            <>
              <div className="section-head mt-14 mb-0">
                <h2 className="label">{t("profiles")}</h2>
              </div>
              <ul>
                {site.socials.map((social) => (
                  <li key={social.url}>
                    <a
                      href={social.url}
                      rel="me noopener"
                      className="group flex items-center justify-between gap-4 border-b border-border py-4 hover:text-accent"
                    >
                      <span className="condensed text-2xl">{social.label}</span>
                      <ExternalIcon width={20} height={20} className="text-muted group-hover:text-accent" />
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section aria-labelledby="kontakt-verein">
          <div className="section-head">
            <h2 id="kontakt-verein" className="label">
              {t("team")}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {site.team.logo ? (
              <Image src={site.team.logo} alt="" width={64} height={64} className="size-16 shrink-0" />
            ) : null}
            <div>
              <p className="condensed text-3xl leading-tight">{site.team.name}</p>
              <p className="text-muted">{site.team.sport}</p>
            </div>
          </div>
          {clubFacts.length > 0 ? (
            <dl className="mt-6 border-t border-border">
              {clubFacts.map((item) => (
                <div key={item.label} className="flex justify-between gap-4 border-b border-border py-3">
                  <dt className="text-muted">{item.label}</dt>
                  <dd className="text-right font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {site.team.url ? (
            <a href={site.team.url} rel="noopener" className="text-link mt-6 inline-flex items-center gap-1.5">
              {t("teamLink")}
              <ExternalIcon width={16} height={16} />
            </a>
          ) : null}
        </section>
      </div>
    </div>
  );
}
