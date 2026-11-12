/**
 * Läuft im <head> vor dem ersten Zeichnen: übernimmt eine gespeicherte
 * Design-Wahl, damit beim Laden nichts hell/dunkel aufblitzt.
 * (Eigene Datei, weil Konstanten aus "use client"-Modulen in Server-
 * Komponenten nur als Client-Referenz ankommen, nicht als Text.)
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}})();`;
