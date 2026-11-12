import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { NavLink, type StaticPathname } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader({ name, number }: { name: string; number?: number }) {
  const t = await getTranslations("nav");
  const tTheme = await getTranslations("theme");

  const items: { href: StaticPathname; label: string }[] = [
    { href: "/ueber-mich", label: t("about") },
    { href: "/projekte", label: t("projects") },
    { href: "/fotos", label: t("photos") },
    { href: "/saison", label: t("season") },
    { href: "/kontakt", label: t("contact") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-bg">
      <div className="container-page relative flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          {number !== undefined ? (
            <span
              aria-hidden="true"
              className="display grid h-8 min-w-8 place-items-center bg-signal px-1 text-xl text-signal-fg"
            >
              {number}
            </span>
          ) : null}
          <span className="display text-[1.125rem] whitespace-nowrap max-[359px]:sr-only sm:text-[1.375rem]">{name}</span>
        </Link>

        <nav aria-label={t("main")} className="hidden md:block">
          <ul className="flex items-center">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  className="block px-3 py-2 text-[0.9375rem] font-medium text-muted transition-colors hover:text-fg data-active:text-fg data-active:underline data-active:decoration-signal data-active:decoration-[3px] data-active:underline-offset-[9px]"
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle label={tTheme("dark")} />
          <MobileNav items={items} label={t("main")} menuLabel={t("menu")} />
        </div>
      </div>
    </header>
  );
}
