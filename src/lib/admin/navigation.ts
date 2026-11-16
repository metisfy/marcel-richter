import type { AdminIconName } from "@/components/admin/icons";

/*
 * Menü des Admin-Bereichs, logisch gruppiert (wie bei t-orga):
 *
 *   Überblick      – was gerade los ist
 *   Website        – was Besucher sehen und schicken
 *   Einstellungen  – wie der Bereich arbeitet, und das eigene Konto
 *
 * Pfade ohne /admin – das Präfix ergänzt die Navigation je nach Host.
 */

export const SIDEBAR_COOKIE = "mr-admin-seitenleiste";
export const SIDEBAR_COLLAPSED = "eingeklappt";

export type NavItem = {
  path: string;
  label: string;
  icon: AdminIconName;
  /** Nur bei genau diesem Pfad aktiv (z. B. Übersichten, unter denen weitere Seiten liegen) */
  exact?: boolean;
  /** Zähler rechts, z. B. ungelesene Nachrichten */
  badge?: number;
};

export type NavGroup = { title: string; items: NavItem[] };

export const NAVIGATION: NavGroup[] = [
  {
    title: "Überblick",
    items: [{ path: "/", label: "Dashboard", icon: "dashboard", exact: true }],
  },
  {
    title: "Website",
    items: [
      { path: "/nachrichten", label: "Nachrichten", icon: "inbox" },
      { path: "/spielbetrieb", label: "Spielbetrieb", icon: "volleyball" },
      { path: "/inhalte", label: "Inhalte & SEO", icon: "pages" },
    ],
  },
  {
    title: "Einstellungen",
    items: [
      { path: "/einstellungen", label: "Übersicht", icon: "settings", exact: true },
      { path: "/einstellungen/mailversand", label: "Mailversand", icon: "mail" },
      { path: "/einstellungen/system", label: "System", icon: "server" },
      { path: "/profil", label: "Mein Profil", icon: "user" },
    ],
  },
];
