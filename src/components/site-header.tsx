import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { NavLink, type StaticPathname } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader({ name, number }: { name: string; number?: number }) {
  const t = await getTranslations("nav");
  const tTheme = await getTranslations("theme");

  const items: { href: StaticPathname; label: string }[] = [
    { href: "/", label: t("home") },
    { href: "/ueber-mich", label: t("about") },
    { href: "/projekte", label: t("projects") },
    { href: "/fotos", label: t("photos") },
    { href: "/saison", label: t("season") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="container-page relative flex h-16 items-center justify-between gap-3">
        <Link href="/" className="shrink-0">
          <Brand name={name} number={number} />
        </Link>

        <nav aria-label={t("main")} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-[14.5px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg aria-[current=page]:font-semibold aria-[current=page]:text-fg data-active:font-semibold data-active:text-fg"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle label={tTheme("dark")} />
          <Link href="/kontakt" className="btn btn-primary btn-nav hidden sm:inline-flex">
            {t("contact")}
          </Link>
          <MobileNav items={[...items, { href: "/kontakt", label: t("contact") }]} label={t("main")} menuLabel={t("menu")} />
        </div>
      </div>
    </header>
  );
}
