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
    <div className="md:hidden">
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
        className="absolute inset-x-0 top-full border-b-[3px] border-rule bg-bg"
      >
        <ul className="container-page flex flex-col pb-4">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink
                href={item.href}
                onClick={() => setOpen(false)}
                className="display flex min-h-13 items-center border-b border-border text-[1.75rem] text-fg hover:text-accent data-active:text-accent"
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
