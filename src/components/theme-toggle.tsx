"use client";

import { useSyncExternalStore } from "react";

import { MoonIcon, SunIcon } from "./icons";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

function isDark(): boolean {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "dark") return true;
  if (chosen === "light") return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * Schaltet zwischen hellem und dunklem Design. Ohne eigene Wahl folgt die
 * Seite der Systemeinstellung; die Wahl wird nur lokal im Browser gemerkt
 * (localStorage, kein Cookie). Das Skript im <head> setzt sie vor dem
 * ersten Zeichnen, damit nichts aufblitzt.
 */
export function ThemeToggle({ label }: { label: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Privater Modus o. Ä. – dann gilt die Wahl nur bis zum Neuladen.
    }
  }

  return (
    <button type="button" className="icon-btn" aria-pressed={dark} onClick={toggle}>
      <span className="sr-only">{label}</span>
      <MoonIcon className="theme-icon-moon" />
      <SunIcon className="theme-icon-sun" />
    </button>
  );
}
