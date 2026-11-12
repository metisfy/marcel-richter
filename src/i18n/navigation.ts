import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// Sprachbewusste Varianten von Link, redirect, usePathname usw.
// Immer diese statt der Next.js-Originale verwenden, damit Links die
// übersetzten Pfade (/projekte ↔ /en/projects) bekommen.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
