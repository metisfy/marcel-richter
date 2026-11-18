"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Meldet jeden Seitenaufruf an die eigene Besucherstatistik (POST
 * /api/besuch, ohne Cookies). Die Herkunftsseite geht nur beim ersten Aufruf
 * mit. Mit „Do Not Track“ oder „Global Privacy Control“ meldet es nichts.
 * Ob die Statistik überhaupt läuft, entscheidet der Server.
 */
export function VisitBeacon() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl) return;
    const body = JSON.stringify({ p: window.location.pathname, r: first.current ? document.referrer : "" });
    first.current = false;
    try {
      // text/plain: ohne Vorab-Anfrage, auch beim Schließen der Seite zuverlässig
      if (!navigator.sendBeacon?.("/api/besuch", new Blob([body], { type: "text/plain" }))) {
        fetch("/api/besuch", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    } catch {
      /* Statistik darf nie stören */
    }
  }, [pathname]);

  return null;
}
