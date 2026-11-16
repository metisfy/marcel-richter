"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";

import { type NavGroup, SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "@/lib/admin/navigation";

import { AdminIcon } from "./icons";

/*
 * Seitenleiste nach Gruppen (wie bei t-orga). Am Desktop fest, einklappbar
 * auf die Symbole; der Zustand steht als `data-sidebar` an <html> (setzt das
 * Layout aus einem Cookie, damit nichts aufblitzt) – Breite und
 * Beschriftungen steuert reines CSS (.admin-aside, .admin-label in
 * globals.css). Am Telefon eine waagerecht scrollende Leiste.
 */

const ATTRIBUTE = "data-sidebar";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [ATTRIBUTE] });
  return () => observer.disconnect();
}

const collapsedNow = () => document.documentElement.getAttribute(ATTRIBUTE) === SIDEBAR_COLLAPSED;

export function Sidebar({ prefix, groups }: { prefix: string; groups: NavGroup[] }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, collapsedNow, () => false);

  const toggle = useCallback(() => {
    const next = !collapsedNow();
    if (next) document.documentElement.setAttribute(ATTRIBUTE, SIDEBAR_COLLAPSED);
    else document.documentElement.removeAttribute(ATTRIBUTE);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? SIDEBAR_COLLAPSED : "offen"}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const active = (path: string, exact?: boolean) => {
    const target = path === "/" ? prefix || "/" : `${prefix}${path}`;
    if (path === "/" || exact) return pathname === target || pathname === `${target}/`;
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  return (
    <aside className="admin-aside border-b border-line bg-bg md:sticky md:top-16 md:flex md:h-[calc(100dvh-4rem)] md:shrink-0 md:flex-col md:border-r md:border-b-0">
      <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 py-2.5 md:flex-1 md:flex-col md:gap-6 md:overflow-y-auto md:px-3 md:py-6">
        {groups.map((group) => (
          <div key={group.title} className="flex shrink-0 gap-1 md:flex-col md:gap-0.5">
            <p className="admin-label mb-1.5 hidden px-3 font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase md:block">
              {group.title}
            </p>
            {group.items.map((item) => {
              const isActive = active(item.path, item.exact);
              const href = item.path === "/" ? prefix || "/" : `${prefix}${item.path}`;
              return (
                <Link
                  key={item.path}
                  href={href}
                  title={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`admin-navlink relative flex h-10 shrink-0 items-center gap-2.5 rounded-xl border px-3 text-[14.5px] font-medium whitespace-nowrap transition-[background-color,color,border-color,translate] duration-150 ${
                    isActive
                      ? "border-accent/30 bg-accent-soft text-accent"
                      : "border-transparent text-muted hover:translate-x-0.5 hover:bg-surface hover:text-fg"
                  }`}
                >
                  <span className="relative shrink-0">
                    <AdminIcon name={item.icon} />
                    {item.badge ? (
                      <span aria-hidden="true" className="admin-dot absolute -top-0.5 -right-0.5 hidden size-2 rounded-full border border-bg bg-accent" />
                    ) : null}
                  </span>
                  <span className="admin-label">{item.label}</span>
                  {item.badge ? (
                    <span className="admin-label ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 font-mono text-[11px] text-white tabular-nums">
                      {item.badge > 99 ? "99+" : item.badge}
                      <span className="sr-only"> ungelesen</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={collapsed}
        aria-label={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
        className="admin-navlink m-3 hidden h-11 items-center gap-2.5 rounded-xl border-t border-line px-3 text-[14.5px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg md:flex"
      >
        <AdminIcon name="sidebar" />
        <span className="admin-label">Einklappen</span>
      </button>
    </aside>
  );
}
