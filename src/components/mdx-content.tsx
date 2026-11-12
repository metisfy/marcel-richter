import Image from "next/image";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ComponentProps } from "react";

/**
 * Komponenten, die in MDX-Dateien zur Verfügung stehen. Beispiel:
 *
 *   <Figure src="/images/projekte/x.jpg" alt="…" caption="…" />
 *
 * Für optimierte, responsive Bilder <Figure> statt ![…](…) verwenden.
 */
function Figure({
  src,
  alt,
  caption,
  ratio = "16/9",
}: {
  src: string;
  alt: string;
  caption?: string;
  ratio?: string;
}) {
  return (
    <figure>
      <div className="relative overflow-hidden bg-subtle" style={{ aspectRatio: ratio }}>
        <Image src={src} alt={alt} fill sizes="(min-width: 768px) 680px, 100vw" className="object-cover" />
      </div>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function MdxImage({ src, alt }: ComponentProps<"img">) {
  // Markdown-Bilder stehen innerhalb von <p>; ein <figure> wäre dort
  // ungültiges HTML. Deshalb hier ein schlichtes, lazy geladenes <img>.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" decoding="async" />;
}

const components = { Figure, img: MdxImage };

export async function MdxContent({ source, lang }: { source: string; lang?: string }) {
  const { content } = await compileMDX({
    source,
    components,
    options: { parseFrontmatter: false },
  });
  return (
    <div className="prose" lang={lang}>
      {content}
    </div>
  );
}
