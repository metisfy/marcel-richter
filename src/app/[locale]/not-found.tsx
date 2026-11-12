import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="container-page py-24 text-center">
      <p className="eyebrow mb-3">404</p>
      <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">{t("text")}</p>
      <Link href="/" className="btn btn-primary mt-8">
        {t("back")}
      </Link>
    </div>
  );
}
