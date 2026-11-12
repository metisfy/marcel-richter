import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { NavLink, type StaticPathname } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader({ name }: { name: string }) {
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
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md supports-[backdrop-filter]:bg-bg/80">
      <div className="container-page relative flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-fg"
          >
            {name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </span>
          <span className="max-[399px]:sr-only">{name}</span>
        </Link>

        <nav aria-label={t("main")} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  className="rounded-full px-3 py-2 text-[0.9375rem] font-medium text-muted transition-colors hover:text-fg data-active:text-fg data-active:underline data-active:decoration-accent data-active:decoration-2 data-active:underline-offset-[10px]"
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
