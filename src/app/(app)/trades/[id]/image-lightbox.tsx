"use client";

import { X, ZoomIn, ZoomOut } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

export interface LightboxImage {
  url: string;
  caption: string | null;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/** Lazy-loaded viewer (§12.3): zoom toggle, arrow keys, Escape, click-away. */
export function ImageLightbox({ images, index, onClose, onIndexChange }: ImageLightboxProps) {
  const [zoomed, setZoomed] = useState(false);
  const current = images[index];
  void onIndexChange; // navigation is exposed below via keyboard + buttons

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setZoomed(false);
        onIndexChange(index + 1);
      }
      if (event.key === "ArrowLeft") {
        setZoomed(false);
        onIndexChange(index - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot viewer"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm">
          {index + 1} / {images.length}
          {current.caption ? ` — ${current.caption}` : ""}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={zoomed ? "Zoom out" : "Zoom in"}
            className="rounded p-2 hover:bg-white/10"
            onClick={() => setZoomed((z) => !z)}
          >
            {zoomed ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          </button>
          <button
            type="button"
            aria-label="Close viewer"
            className="rounded p-2 hover:bg-white/10"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) setZoomed((z) => !z);
        }}
      >
        <Image
          src={current.url}
          alt={current.caption ?? "Screenshot"}
          width={1920}
          height={1200}
          className={
            zoomed
              ? "max-h-none max-w-none cursor-zoom-out"
              : "max-h-full max-w-full cursor-zoom-in object-contain"
          }
          unoptimized={current.url.startsWith("/api/uploads/")}
        />
      </div>
    </div>
  );
}
