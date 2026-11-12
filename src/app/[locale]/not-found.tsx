import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="container-page py-24 text-center sm:py-32">
      <p className="badge">
        <span aria-hidden="true" className="badge-dot bg-loss" />
        404
      </p>
      <h1 className="mt-6 text-[clamp(2.25rem,1.5rem+3vw,3.5rem)] leading-tight font-bold tracking-[-0.03em]">{t("title")}</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">{t("text")}</p>
      <Link href="/" className="btn btn-dark mt-8">
        {t("back")}
      </Link>
    </div>
  );
}
