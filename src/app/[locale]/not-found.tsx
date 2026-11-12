import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="container-page py-20 sm:py-28">
      <p aria-hidden="true" className="display text-[clamp(6rem,22vw,14rem)] text-accent">404</p>
      <h1 className="display mt-4 text-5xl">{t("title")}</h1>
      <p className="mt-4 max-w-md text-muted">{t("text")}</p>
      <Link href="/" className="btn btn-primary mt-8">
        {t("back")}
      </Link>
    </div>
  );
}
