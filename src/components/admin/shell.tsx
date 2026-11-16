import type { ReactNode } from "react";

import { logout } from "@/app/admin/actions";
import { ExternalIcon } from "@/components/icons";
import type { Admin } from "@/lib/admin/accounts";
import { adminPrefix } from "@/lib/admin/guard";
import { countUnread } from "@/lib/admin/messages";
import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";

import { AdminNav } from "./nav";

/** Rahmen aller angemeldeten Admin-Seiten: Kopfzeile mit Navigation und Abmelden. */
export async function AdminShell({ admin, title, children }: { admin: Admin; title: string; children: ReactNode }) {
  const prefix = await adminPrefix();
  const unread = await countUnread().catch(() => 0);
  const initials = admin.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <a href={prefix || "/"} className="flex items-center gap-2.5 font-semibold tracking-[-0.01em]">
            <span aria-hidden="true" className="brand-mark">
              MR
            </span>
            <span className="hidden sm:inline">Admin</span>
          </a>
          <AdminNav
            prefix={prefix}
            items={[
              { href: "/", label: "Übersicht" },
              { href: "/nachrichten", label: "Nachrichten", badge: unread },
              { href: "/einstellungen", label: "Einstellungen" },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <a
              href={SITE_URL_CONFIGURED ? SITE_URL : "/"}
              target="_blank"
              rel="noopener"
              className="icon-btn"
              title="Website öffnen"
              aria-label="Website öffnen"
            >
              <ExternalIcon width={16} height={16} />
            </a>
            <span
              title={`${admin.name} · ${admin.email}`}
              className="hidden size-9 place-items-center rounded-full bg-accent-soft font-mono text-[12px] font-medium text-accent sm:grid"
            >
              {initials}
            </span>
            <form action={logout}>
              <button type="submit" className="btn btn-ghost btn-nav">
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="inhalt" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="mb-8 text-[clamp(1.6rem,1.3rem+1.2vw,2.2rem)] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
        {children}
      </main>
    </div>
  );
}
