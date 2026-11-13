import Image from "next/image";
import type { CSSProperties } from "react";

import { imageSize } from "@/lib/content";

/**
 * Screenshot einer ganzen Website im Browserfenster, der langsam von oben nach
 * unten durchläuft (und zurück) – wie auf metisone.de. Beim Darüberfahren hält
 * er an; bei „Bewegung reduzieren“ läuft nichts, das Fenster lässt sich dann
 * von Hand scrollen (CSS in globals.css: .shot-frame, .shot-scroll).
 */
export function BrowserFrame({ src, alt, url }: { src: string; alt: string; url?: string }) {
  const size = imageSize(src);
  if (!size) return null;
  const host = url ? new URL(url).host.replace(/^www\./, "") : undefined;
  // Längere Seiten laufen langsamer: etwa eine Sekunde je 200 Bildpunkte (bei 1200 px Breite)
  const duration = Math.max(10, Math.round((size.height / size.width) * 6));

  return (
    <figure className="card overflow-hidden shadow-soft">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#febc2e]" />
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[#28c840]" />
        {host ? (
          <span className="mx-auto max-w-[60%] truncate rounded-md border border-line bg-bg px-3 py-1 font-mono text-[12px] text-muted">{host}</span>
        ) : null}
      </div>
      <div className="shot-frame relative bg-surface" style={{ "--shot-duration": `${duration}s` } as CSSProperties} tabIndex={0} aria-label={alt}>
        <Image
          src={src}
          alt={alt}
          width={size.width}
          height={size.height}
          sizes="(min-width: 1152px) 1104px, 100vw"
          className="shot-scroll block h-auto w-full"
        />
      </div>
    </figure>
  );
}
