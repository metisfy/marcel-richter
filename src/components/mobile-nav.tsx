"use client";

import { useEffect, useId, useState } from "react";

import { CloseIcon, MenuIcon } from "./icons";
import { NavLink, type StaticPathname } from "./nav-link";

export function MobileNav({
  items,
  label,
  menuLabel,
}: {
  items: { href: StaticPathname; label: string }[];
  label: string;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="icon-btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sr-only">{menuLabel}</span>
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      <nav
        id={panelId}
        aria-label={label}
        hidden={!open}
        className="mobile-panel absolute inset-x-0 top-full border-b border-line bg-bg shadow-soft"
      >
        <ul className="container-page flex flex-col py-3">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center rounded-lg px-3 text-base font-medium text-muted hover:bg-surface hover:text-fg aria-[current=page]:text-fg data-active:font-semibold data-active:text-fg"
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
