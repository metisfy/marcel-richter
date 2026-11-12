import type { ReactNode } from "react";

// Das eigentliche Layout (mit <html lang>) liegt in [locale]/layout.tsx.
// Diese Datei reicht nur durch – sie ist nötig, damit app/not-found.tsx und
// [locale]/not-found.tsx als normale 404-Grenzen greifen und die 404-Seite
// serverseitig gerendert wird.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
