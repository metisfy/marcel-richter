import Link from "next/link";
import type { ReactNode } from "react";

import { logout } from "@/app/admin/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Admin } from "@/lib/admin/accounts";
import { adminPrefix } from "@/lib/admin/guard";
import { countUnread } from "@/lib/admin/messages";
import { NAVIGATION } from "@/lib/admin/navigation";
import { SITE_URL, SITE_URL_CONFIGURED } from "@/lib/site-url";

import { ProfileMenu } from "./profile-menu";
import { Sidebar } from "./sidebar";

const YEAR = new Date().getFullYear();

/**
 * Rahmen aller angemeldeten Admin-Seiten (wie die „Schale“ bei t-orga):
 * Kopfzeile mit Bereichsnamen, Hell/Dunkel und Profilmenü, links die
 * gruppierte Seitenleiste, rechts der Inhalt, unten die Fußzeile.
 */
export async function AdminShell({ admin, children }: { admin: Admin; children: ReactNode }) {
  const prefix = await adminPrefix();
  const unread = await countUnread().catch(() => 0);
  const groups = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.map((item) => (item.path === "/nachrichten" && unread > 0 ? { ...item, badge: unread } : item)),
  }));
  const siteUrl = SITE_URL_CONFIGURED ? SITE_URL : "/";

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={prefix || "/"} className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="brand-mark shrink-0">
              MR
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-semibold">Marcel Richter</span>
              <span className="block truncate text-xs text-muted">Admin-Dashboard</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle label="Hell oder dunkel" />
            <ProfileMenu name={admin.name} email={admin.email} prefix={prefix} siteUrl={siteUrl} logout={logout} />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar prefix={prefix} groups={groups} />
        <main id="inhalt" className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <div className="admin-page mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      <footer className="flex flex-wrap justify-between gap-2 border-t border-line bg-bg px-4 py-4 text-xs text-muted sm:px-6">
        <span>© {YEAR} metisCode · metisOne</span>
        <span className="font-mono">Version {(process.env.GIT_SHA ?? "dev").slice(0, 7)}</span>
      </footer>
    </div>
  );
}
