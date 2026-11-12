import { Archivo } from "next/font/google";

/*
 * Archivo als variable Schrift mit Breiten-Achse (wdth 62–125): Fließtext in
 * normaler Breite, Überschriften und Zahlen schmal und fett (.display).
 * Eine einzige Datei, beim Build heruntergeladen und selbst ausgeliefert –
 * der Browser fragt nie bei Google an.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
