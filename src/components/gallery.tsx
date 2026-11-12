"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import type { Photo } from "@/lib/content";

import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./icons";

export type GalleryLabels = {
  open: string;
  close: string;
  previous: string;
  next: string;
  /** enthält die Platzhalter {current} und {total} */
  position: string;
};

/**
 * Bildraster mit Lightbox auf Basis des nativen <dialog>: Fokusfalle,
 * Escape zum Schließen und Hintergrund-Sperre liefert der Browser.
 * Pfeiltasten blättern, ein Klick neben das Bild schließt.
 */
export function Gallery({
  photos,
  title,
  labels,
}: {
  photos: Photo[];
  title: string;
  labels: GalleryLabels;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  const photo = index !== null ? photos[index] : undefined;

  function open(i: number, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setIndex(i);
    dialogRef.current?.showModal();
  }

  function step(delta: number) {
    setIndex((current) =>
      current === null ? current : (current + delta + photos.length) % photos.length,
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "ArrowRight") step(1);
    if (event.key === "ArrowLeft") step(-1);
  }

  function onBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) dialogRef.current?.close();
  }

  function onClose() {
    setIndex(null);
    triggerRef.current?.focus();
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((item, i) => (
          <li key={item.src}>
            <button
              type="button"
              onClick={(event) => open(i, event.currentTarget)}
              className="group relative block aspect-square w-full overflow-hidden bg-subtle"
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(min-width: 1024px) 270px, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <span className="sr-only"> ({labels.open})</span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={title}
        className="lightbox"
        onKeyDown={onKeyDown}
        onClick={onBackdropClick}
        onClose={onClose}
      >
        <div className="flex items-center justify-between gap-4 p-3 sm:p-4">
          <p className="text-sm text-[#c9c7c0] tabular-nums" aria-live="polite">
            {index !== null
              ? labels.position
                  .replace("{current}", String(index + 1))
                  .replace("{total}", String(photos.length))
              : null}
          </p>
          <button type="button" className="lightbox-btn" onClick={() => dialogRef.current?.close()}>
            <span className="sr-only">{labels.close}</span>
            <CloseIcon />
          </button>
        </div>

        {photo ? (
          <figure className="pointer-events-none flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-3 pb-4 sm:px-20">
            <div className="pointer-events-auto relative h-full max-h-[78dvh] w-full">
              <Image
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
            {photo.caption ? (
              <figcaption className="pointer-events-auto max-w-2xl text-center text-sm text-[#dedcd5]">
                {photo.caption}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        {photos.length > 1 ? (
          <div className="flex justify-center gap-3 pb-4 sm:pointer-events-none sm:absolute sm:inset-x-4 sm:top-1/2 sm:-translate-y-1/2 sm:justify-between sm:pb-0">
            <button type="button" className="lightbox-btn sm:pointer-events-auto" onClick={() => step(-1)}>
              <span className="sr-only">{labels.previous}</span>
              <ChevronLeftIcon />
            </button>
            <button type="button" className="lightbox-btn sm:pointer-events-auto" onClick={() => step(1)}>
              <span className="sr-only">{labels.next}</span>
              <ChevronRightIcon />
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
