import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { ArrowRightIcon, ExternalIcon, MailIcon } from "@/components/icons";
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
  const tHome = await getTranslations("home");
  const tPlayer = await getTranslations("player");
  const site = getSite(locale);

  const clubFacts = [
    { label: tPlayer("league"), value: site.team.league },
    { label: tPlayer("position"), value: site.team.position },
    { label: tPlayer("number"), value: site.team.number !== undefined ? `#${site.team.number}` : undefined },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <div className="container-page">
      <PageIntro eyebrow={t("title")} title={tHome("ctaTitle")} lead={t("lead")} />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5" data-reveal-stagger>
          <section aria-labelledby="kontakt-mail" className="card p-6 sm:p-8">
            <h2 id="kontakt-mail" className="eyebrow">
              {t("email")}
            </h2>
            <a
              href={`mailto:${site.email}`}
              className="mt-4 flex items-center gap-3 text-[clamp(1.375rem,1rem+1.6vw,2rem)] font-semibold tracking-[-0.02em] break-all hover:text-accent"
            >
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <MailIcon width={20} height={20} />
              </span>
              {site.email}
            </a>
            <a href={`mailto:${site.email}`} className="btn btn-primary mt-7">
              {tHome("ctaMail")}
              <ArrowRightIcon width={17} height={17} />
            </a>
          </section>

          {site.socials.length > 0 ? (
            <section aria-labelledby="kontakt-profile" className="card p-6 sm:p-8">
              <h2 id="kontakt-profile" className="eyebrow">
                {t("profiles")}
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {site.socials.map((social) => (
                  <li key={social.url}>
                    <a
                      href={social.url}
                      rel="me noopener"
                      className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 font-medium transition-colors hover:bg-surface"
                    >
                      {social.label}
                      <ExternalIcon width={16} height={16} className="text-muted" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-5" data-reveal-stagger>
        {site.company ? (
          <section aria-labelledby="kontakt-firma" className="card p-6 sm:p-8">
            <h2 id="kontakt-firma" className="eyebrow">
              {t("company")}
            </h2>
            <p className="mt-5 text-xl font-semibold tracking-[-0.01em]">{site.company.legalName}</p>
            <p className="text-muted">
              {site.name}, {site.company.role}
            </p>
            <ul className="mt-6 space-y-2.5">
              {[{ name: site.company.name, url: site.company.url, description: site.company.city }, ...site.company.projects].map((entry) => (
                <li key={entry.url}>
                  <a
                    href={entry.url}
                    rel="noopener"
                    className="group flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:bg-surface"
                  >
                    <span>
                      <span className="block font-medium">{entry.name}</span>
                      {entry.description ? <span className="block text-sm text-muted">{entry.description}</span> : null}
                    </span>
                    <ExternalIcon width={16} height={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="kontakt-verein" className="card bg-surface p-6 sm:p-8">
          <h2 id="kontakt-verein" className="eyebrow">
            {t("team")}
          </h2>
          <div className="mt-5 flex items-center gap-4">
            {site.team.logo ? (
              <Image src={site.team.logo} alt="" width={56} height={56} className="size-14 shrink-0 rounded-xl" />
            ) : null}
            <div>
              <p className="text-xl font-semibold tracking-[-0.01em]">{site.team.name}</p>
              <p className="text-muted">{site.team.sport}</p>
            </div>
          </div>
          {clubFacts.length > 0 ? (
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {clubFacts.map((item) => (
                <div key={item.label} className="flex justify-between gap-4 py-3 text-[15px]">
                  <dt className="text-muted">{item.label}</dt>
                  <dd className="text-right font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {site.team.url ? (
            <a href={site.team.url} rel="noopener" className="arrow-link mt-6">
              {t("teamLink")}
            </a>
          ) : null}
        </section>
        </div>
      </div>
    </div>
  );
}
