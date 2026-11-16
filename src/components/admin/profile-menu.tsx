"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AdminIcon } from "./icons";

/** Profilmenü oben rechts (wie bei t-orga): Name, Mein Profil, Sicherheit, Website, Abmelden. */
export function ProfileMenu({
  name,
  email,
  prefix,
  siteUrl,
  logout,
}: {
  name: string;
  email: string;
  prefix: string;
  siteUrl: string;
  logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14.5px] hover:bg-surface";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-xl border border-line pr-2.5 pl-1 transition-colors hover:bg-surface"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft font-mono text-[12px] font-medium text-accent">{initials}</span>
        <span className="hidden max-w-36 truncate text-[14px] font-medium sm:block">{name}</span>
        <AdminIcon name="chevron" width={16} height={16} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-line bg-bg p-1.5 shadow-soft">
          <div className="border-b border-line px-3 pt-2 pb-3">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
          <div className="py-1.5">
            <Link role="menuitem" href={`${prefix}/profil`} className={item} onClick={() => setOpen(false)}>
              <AdminIcon name="user" width={18} height={18} className="text-muted" />
              Mein Profil
            </Link>
            <Link role="menuitem" href={`${prefix}/profil#zwei-faktor`} className={item} onClick={() => setOpen(false)}>
              <AdminIcon name="shield" width={18} height={18} className="text-muted" />
              Sicherheit
            </Link>
            <a role="menuitem" href={siteUrl} target="_blank" rel="noopener" className={item}>
              <AdminIcon name="external" width={18} height={18} className="text-muted" />
              Website öffnen
            </a>
          </div>
          <form action={logout} className="border-t border-line pt-1.5">
            <button role="menuitem" type="submit" className={`${item} text-loss`}>
              <AdminIcon name="logout" width={18} height={18} />
              Abmelden
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
