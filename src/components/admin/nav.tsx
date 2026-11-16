"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Hauptnavigation; der aktive Punkt richtet sich nach der Adresse im Browser (mit oder ohne /admin). */
export function AdminNav({ prefix, items }: { prefix: string; items: { href: string; label: string; badge?: number }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {items.map((item) => {
        const href = item.href === "/" ? prefix || "/" : `${prefix}${item.href}`;
        const active = item.href === "/" ? pathname === href || pathname === `${prefix}/` : pathname.startsWith(href);
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[14.5px] font-medium transition-colors ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface hover:text-fg"
            }`}
          >
            {item.label}
            {item.badge ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 font-mono text-[11px] text-white tabular-nums">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
