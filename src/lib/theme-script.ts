/**
 * Läuft im <head> vor dem ersten Zeichnen:
 * - übernimmt eine gespeicherte Design-Wahl, damit nichts hell/dunkel aufblitzt
 * - setzt `data-top` an <html>, solange die Seite ganz oben steht. Dann ist die
 *   Kopfzeile durchsichtig und der Farbverlauf der Startseite läuft bis an den
 *   oberen Rand. Ohne JavaScript fehlt das Attribut und die Kopfzeile bleibt
 *   deckend.
 * (Eigene Datei, weil Konstanten aus "use client"-Modulen in Server-
 * Komponenten nur als Client-Referenz ankommen, nicht als Text.)
 */
export const themeInitScript = `(function(){var r=document.documentElement;try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){r.dataset.theme=t}}catch(e){}function u(){r.toggleAttribute("data-top",window.scrollY<8)}u();window.addEventListener("scroll",u,{passive:true})})();`;
