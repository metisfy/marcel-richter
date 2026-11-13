"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal],[data-reveal-stagger]";

/**
 * Blendet Elemente mit `data-reveal` bzw. `data-reveal-stagger` ein, sobald
 * sie ins Bild scrollen (CSS dazu am Ende von globals.css).
 *
 * Damit nichts aufblitzt oder fehlt:
 * - Ohne JavaScript und vor dem ersten Durchlauf ist alles sichtbar – erst die
 *   Klasse `reveal` an <html> versteckt noch nicht gezeigte Elemente.
 * - Was beim ersten Durchlauf schon im Bild ist, bekommt `data-shown="instant"`
 *   und bleibt einfach stehen (keine Animation, kein Flackern).
 * - Elemente, die später dazukommen (Seitenwechsel), erkennt ein
 *   MutationObserver; sie blenden ein, sobald sie sichtbar sind.
 * - Bei „Bewegung reduzieren“ passiert gar nichts.
 */
export function RevealObserver() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    const seen = new WeakSet<Element>();

    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = "";
          intersection.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    function scan(initial: boolean) {
      for (const element of document.querySelectorAll<HTMLElement>(SELECTOR)) {
        if (seen.has(element)) continue;
        seen.add(element);
        const rect = element.getBoundingClientRect();
        const inView = rect.top < window.innerHeight && rect.bottom > 0;
        // Schon sichtbar beim Laden oder bereits darüber hinweggescrollt
        // (z. B. Sprung zu einem Anker): stehen lassen statt animieren.
        if ((initial && inView) || rect.bottom <= 0) {
          element.dataset.shown = "instant";
          continue;
        }
        intersection.observe(element);
      }
    }

    scan(true);
    root.classList.add("reveal");

    let frame = 0;
    const mutation = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => scan(false));
    });
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mutation.disconnect();
      intersection.disconnect();
    };
  }, []);

  return null;
}
