"use client";

import { ImageIcon, ListOrdered, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  deleteTradeImage,
  reorderTradeImages,
  updateTradeImage,
} from "@/features/journal-images/actions";
import type { TradeImageRow } from "@/features/journal-images/queries";

const Lightbox = dynamic(
  () => import("@/app/(app)/trades/[id]/image-lightbox").then((m) => m.ImageLightbox),
  { ssr: false },
);

const KINDS = ["entry", "exit", "htf", "other"] as const;
const KIND_LABELS = { entry: "Entry", exit: "Exit", htf: "HTF context", other: "Other" } as const;

export interface TradeImageClient {
  id: string;
  tradeId: string;
  url: string;
  caption: string | null;
  kind: (typeof KINDS)[number];
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  blurDataUrl: string | null;
  sortOrder: number;
}

interface ScreenshotGalleryProps {
  tradeId: string;
  initialImages: TradeImageRow[];
  driver: "local" | "vercel";
}

/** Compress + measure + tiny blur placeholder, entirely client-side (§13). */
async function prepare(file: File): Promise<{
  blob: Blob;
  width: number;
  height: number;
  blurDataUrl: string;
}> {
  const { default: compress } = await import("browser-image-compression");
  const compressed = await compress(file, {
    maxWidthOrHeight: 1920,
    initialQuality: 0.85,
    useWebWorker: true,
  });
  const bitmap = await createImageBitmap(compressed);
  const canvas = document.createElement("canvas");
  canvas.width = 12;
  canvas.height = Math.max(1, Math.round((12 * bitmap.height) / bitmap.width));
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return {
    blob: compressed,
    width: bitmap.width,
    height: bitmap.height,
    blurDataUrl: canvas.toDataURL("image/jpeg", 0.5),
  };
}

export function ScreenshotGallery({ tradeId, initialImages, driver }: ScreenshotGalleryProps) {
  const [images, setImages] = useState<TradeImageClient[]>(
    initialImages.map((row) => ({
      id: row.id,
      tradeId: row.tradeId,
      url: row.url,
      caption: row.caption,
      kind: row.kind,
      width: row.width,
      height: row.height,
      sizeBytes: row.sizeBytes,
      blurDataUrl: row.blurDataUrl,
      sortOrder: row.sortOrder,
    })),
  );
  const [uploading, setUploading] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (files: File[]) => {
      for (const file of files.slice(0, 10)) {
        if (!file.type.startsWith("image/")) continue;
        setUploading((count) => count + 1);
        try {
          const prepared = await prepare(file);
          const formData = new FormData();
          formData.append("tradeId", tradeId);
          formData.append("file", new File([prepared.blob], file.name, { type: prepared.blob.type }));
          formData.append("width", String(prepared.width));
          formData.append("height", String(prepared.height));
          formData.append("blurDataUrl", prepared.blurDataUrl);
          const res = await fetch("/api/blob/upload", { method: "POST", body: formData });
          const body = (await res.json()) as { image?: TradeImageClient; error?: string };
          if (!res.ok || !body.image) {
            toast.error(body.error ?? "Upload failed");
            continue;
          }
          const uploaded = body.image;
          setImages((prev) => [...prev, uploaded]);
          toast.success("Screenshot added");
        } catch (error) {
          toast.error(`Upload failed: ${error instanceof Error ? error.message : "error"}`);
        } finally {
          setUploading((count) => count - 1);
        }
      }
    },
    [tradeId],
  );

  // Clipboard paste (§8.2 #3: Ctrl/Cmd+V)
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length > 0) void upload(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [upload]);

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void upload(Array.from(event.dataTransfer.files));
  }

  async function changeKind(imageId: string, kind: (typeof KINDS)[number]) {
    setImages((prev) => prev.map((image) => (image.id === imageId ? { ...image, kind } : image)));
    const result = await updateTradeImage({ imageId, kind });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
  }

  async function saveCaption(imageId: string, caption: string) {
    const result = await updateTradeImage({ imageId, caption });
    if (!result.ok) toast.error(result.error);
  }

  async function confirmDelete() {
    const imageId = pendingDelete;
    setPendingDelete(null);
    if (!imageId) return;
    const result = await deleteTradeImage({ imageId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setImages((prev) => prev.filter((image) => image.id !== imageId));
    toast.success("Screenshot deleted");
    return;
  }

  function onDropReorder(targetIndex: number) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === targetIndex) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    setImages(next);
    void reorderTradeImages({ tradeId, orderedIds: next.map((image) => image.id) }).then(
      (result) => {
        if (!result.ok) {
          toast.error(result.error);
          setImages(images); // revert on failure
        }
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Screenshots</CardTitle>
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
          {driver === "local" ? "local storage" : "Vercel Blob"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          role="button"
          tabIndex={0}
          aria-label="Add screenshots — drop, click or paste"
          onDrop={onDrop}
          onDragOver={(event) => event.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          {uploading > 0 ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-5" aria-hidden="true" />
          )}
          <span>
            Drop images, click to browse, or paste (Ctrl/Cmd+V)
            {uploading > 0 ? ` — uploading ${uploading}…` : ""}
          </span>
          <span className="text-xs">Compressed to ≤1920px before upload · PNG / JPEG / WebP</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              void upload(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          {/* Mobile camera fallback (§12.2) */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Camera capture"
            className="hidden"
            onChange={(event) => {
              void upload(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </div>

        {images.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ImageIcon className="size-3.5" aria-hidden="true" />
            No screenshots yet — add entry, exit and higher-timeframe context.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image, index) => (
              <li
                key={image.id}
                draggable
                onDragStart={() => (dragIndexRef.current = index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => onDropReorder(index)}
                className="group flex flex-col gap-1.5 rounded-xl border p-2"
              >
                <button
                  type="button"
                  className="relative overflow-hidden rounded-lg"
                  onClick={() => setLightboxIndex(index)}
                  aria-label={`Open screenshot ${index + 1} in lightbox`}
                >
                  <Image
                    src={image.url}
                    alt={image.caption ?? `Screenshot ${index + 1}`}
                    width={image.width ?? 640}
                    height={image.height ?? 400}
                    blurDataURL={image.blurDataUrl ?? undefined}
                    placeholder={image.blurDataUrl ? "blur" : "empty"}
                    sizes="(max-width: 640px) 45vw, 220px"
                    className="h-28 w-full object-cover"
                    unoptimized={image.url.startsWith("/api/uploads/")}
                  />
                  <span className="absolute left-1 top-1">
                    <Badge variant="outline" className="bg-background/80 text-[10px]">
                      {KIND_LABELS[image.kind]}
                    </Badge>
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <Select
                    value={image.kind}
                    onValueChange={(value) => void changeKind(image.id, value as (typeof KINDS)[number])}
                  >
                    <SelectTrigger className="h-6 flex-1 px-2 text-[11px]" aria-label="Image kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind} className="text-xs">
                          {KIND_LABELS[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    aria-label="Delete screenshot"
                    onClick={() => setPendingDelete(image.id)}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
                <Input
                  defaultValue={image.caption ?? ""}
                  placeholder="Caption…"
                  className="h-7 text-xs"
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== (image.caption ?? "")) void saveCaption(image.id, value);
                  }}
                />
                <span className="flex items-center gap-1 px-0.5 text-[10px] text-muted-foreground">
                  <ListOrdered className="size-3" aria-hidden="true" />
                  drag to reorder
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete screenshot?"
        description="This removes the image and its stored bytes. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          await confirmDelete();
        }}
      />

      {lightboxIndex !== null && images[lightboxIndex] ? (
        <Lightbox
          images={images.map((image) => ({ url: image.url, caption: image.caption }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={(index) =>
            setLightboxIndex(((index % images.length) + images.length) % images.length)
          }
        />
      ) : null}
    </Card>
  );
}
