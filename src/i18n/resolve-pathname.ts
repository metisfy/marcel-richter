import { routing, type AppPathname, type Locale } from "./routing";

function matches(template: string, pathname: string): boolean {
  const pattern = template.replace(/[.*+?^${}()|\\]/g, "\\$&").replace(/\\?\[[^\]]+\\?\]/g, "[^/]+");
  return new RegExp(`^${pattern}/?$`).test(pathname);
}

/**
 * Ermittelt die interne Route (z. B. "/projekte/[slug]") zu einem Browser-Pfad.
 *
 * Warum nicht einfach usePathname() von next-intl? Beim statischen
 * Vorrendern sieht die Seite ihren INTERNEN Pfad (/en/projekte/x), im Browser
 * dagegen den öffentlichen (/en/projects/x). next-intl erkennt nur den
 * öffentlichen – im vorgerenderten HTML stünden sonst falsche Links.
 * Diese Funktion akzeptiert beide Formen.
 */
export function resolveInternalPathname(pathname: string, locale: Locale): AppPathname | undefined {
  let path = pathname || "/";
  for (const candidate of routing.locales) {
    if (path === `/${candidate}`) {
      path = "/";
      break;
    }
    if (path.startsWith(`/${candidate}/`)) {
      path = path.slice(candidate.length + 1);
      break;
    }
  }

  for (const [internal, localized] of Object.entries(routing.pathnames)) {
    const templates = typeof localized === "string" ? [internal] : [internal, localized[locale]];
    if (templates.some((template) => matches(template, path))) return internal as AppPathname;
  }
  return undefined;
}
