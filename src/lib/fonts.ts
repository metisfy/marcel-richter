import { Inter, JetBrains_Mono } from "next/font/google";

/*
 * Schriften wie auf metisone.de: Inter für Text und Überschriften,
 * JetBrains Mono für kleine Beschriftungen. Beim Build heruntergeladen und
 * selbst ausgeliefert – der Browser fragt nie bei Google an.
 */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

export const fontVariables = `${inter.variable} ${jetbrainsMono.variable}`;
