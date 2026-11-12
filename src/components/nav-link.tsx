"use client";

import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import type { AppPathname } from "@/i18n/routing";

export type StaticPathname = Exclude<AppPathname, `${string}[${string}`>;

export function NavLink({
  href,
  children,
  className,
  onClick,
}: {
  href: StaticPathname;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  // Liefert die interne Route (z. B. "/projekte/[slug]"), unabhängig von
  // der Sprache – deshalb reicht ein Vergleich mit den Ordnernamen.
  const pathname = usePathname();
  const current = pathname === href;
  const inSection = current || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      data-active={inSection ? "" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}
