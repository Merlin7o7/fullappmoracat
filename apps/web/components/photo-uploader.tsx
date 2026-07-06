"use client";

// ════════════════════════════════════════════════════════════════════════
//  PhotoUploader — production image upload used everywhere (cat photo, profile
//  picture, cover, gallery). Drag & drop, tap-to-choose (mobile camera/gallery),
//  interactive crop + ROTATE + pinch/zoom, client-side compression to WebP, and
//  a real upload PROGRESS bar. Uploads to object storage via the API; the user
//  never pastes a URL. Rejects non-images and oversize files.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { Camera, ImageUp, Loader2, X, ZoomIn, Check, RotateCw } from "lucide-react";
import { Button, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { ImgWithFallback } from "@/components/img-with-fallback";

export interface PhotoUploaderProps {
  /** API path the compressed image is POSTed to (multipart field "file"). */
  endpoint: string;
  /** Receives the API JSON response (e.g. { url } or { photoUrl }). */
  onUploaded: (result: Record<string, unknown>) => void | Promise<void>;
  aspect?: number;
  maxEdge?: number;
  rounded?: boolean;
  currentUrl?: string | null;
  label?: string;
  hint?: string;
  isAr?: boolean;
}

// JPEG, not WebP: canvas WebP *encoding* is unreliable on mobile Safari (older
// iOS falls back to PNG or produces broken output). JPEG toBlob is universal.
const OUT_TYPE = "image/jpeg";
const OUT_QUALITY = 0.85;
const MAX_INPUT_BYTES = 25 * 1024 * 1024; // pre-normalization guard
// Downscale huge camera photos before any canvas work — iOS Safari blanks/fails
// canvases over a device memory limit, and 12MP+ camera shots routinely exceed it.
const MAX_SOURCE_EDGE = 2200;

export function PhotoUploader({
  endpoint,
  onUploaded,
  aspect = 1,
  maxEdge = 900,
  rounded = false,
  currentUrl,
  label,
  hint,
  isAr = false,
}: PhotoUploaderProps) {
  const { uploadImage } = useAuth();
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [src, setSrc] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [preparing, setPreparing] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null); // null = idle

  async function pickFile(file: File | undefined | null) {
    if (!file) return;
    // Accept anything the browser reports as an image, plus empty-type (iOS can
    // hand back a HEIC/HEIF file with a blank MIME). Real decoding is validated
    // during normalization below; obvious non-images are rejected here.
    const looksImage = file.type === "" || /^image\//i.test(file.type);
    if (!looksImage) {
      toast({ title: isAr ? "الرجاء اختيار صورة" : "Please choose an image", variant: "error" });
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast({ title: isAr ? "الصورة كبيرة جداً (الحد ٢٥MB)" : "That image is too large (25 MB max)", variant: "error" });
      return;
    }
    setPreparing(true);
    try {
      // Normalize once: apply EXIF orientation and downscale. Everything
      // downstream (crop preview + output) is then upright and memory-safe.
      const normalized = await normalizeToDataUrl(file);
      setSrc(normalized);
    } catch {
      toast({
        title: isAr ? "تعذّر قراءة هذه الصورة" : "Couldn't read that image",
        description: isAr ? "جرّب صورة بصيغة JPG أو PNG." : "Try a JPG or PNG image.",
        variant: "error",
      });
    } finally {
      setPreparing(false);
    }
  }

  async function handleCropped(blob: Blob) {
    setSrc(null);
    setProgress(0);
    try {
      const res = await uploadImage<Record<string, unknown>>(endpoint, blob, {
        filename: "photo.jpg",
        onProgress: (p) => setProgress(p),
      });
      await onUploaded(res);
      toast({ title: isAr ? "تم رفع الصورة" : "Photo uploaded", variant: "success" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : isAr ? "فشل الرفع" : "Upload failed", variant: "error" });
    } finally {
      setProgress(null);
    }
  }

  const uploading = progress !== null;
  const busy = uploading || preparing;

  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-medium">{label}</p>}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) pickFile(e.dataTransfer.files?.[0]);
        }}
        aria-label={label || (isAr ? "رفع صورة" : "Upload photo")}
        aria-busy={busy}
        className={cn(
          "group relative flex cursor-pointer items-center gap-4 overflow-hidden border border-dashed p-3 transition-colors",
          rounded ? "rounded-2xl" : "rounded-2xl",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
          busy && "cursor-default"
        )}
      >
        <span
          className={cn(
            "relative grid size-16 shrink-0 place-items-center overflow-hidden bg-muted",
            rounded ? "rounded-full" : "rounded-xl"
          )}
        >
          <ImgWithFallback
            src={currentUrl}
            alt=""
            className="size-full object-cover"
            fallback={<Camera className="size-6 text-muted-foreground" />}
          />
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-background/75">
              <Loader2 className="size-5 animate-spin text-primary" />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          {preparing ? (
            <p className="text-sm font-medium">{isAr ? "جارٍ التحضير…" : "Preparing…"}</p>
          ) : uploading ? (
            <>
              <p className="text-sm font-medium">{isAr ? "جارٍ الرفع…" : "Uploading…"}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">{progress ?? 0}%</p>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <ImageUp className="size-4 text-primary" />
                {currentUrl ? (isAr ? "تغيير الصورة" : "Change photo") : isAr ? "رفع صورة" : "Upload photo"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {hint ?? (isAr ? "اسحب وأفلت، أو اضغط للاختيار — JPG / PNG / WebP" : "Drag & drop, or tap to choose — JPG / PNG / WebP")}
              </p>
            </>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {src && (
        <ImageCropper
          initialSrc={src}
          aspect={aspect}
          maxEdge={maxEdge}
          rounded={rounded}
          isAr={isAr}
          onCancel={() => setSrc(null)}
          onConfirm={handleCropped}
        />
      )}
    </div>
  );
}

// ── Cropper modal (pan + zoom + rotate) ─────────────────────────────────────

interface CropperProps {
  initialSrc: string;
  aspect: number;
  maxEdge: number;
  rounded: boolean;
  isAr: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Decode a picked file into an upright, downscaled JPEG data URL. `createImageBitmap`
 * with `imageOrientation: "from-image"` bakes out EXIF rotation (so iPhone camera
 * shots aren't sideways) and lets us cap dimensions before any canvas work,
 * sidestepping iOS Safari's canvas memory limits on large photos. Falls back to
 * an <img> decode where createImageBitmap isn't available.
 */
async function normalizeToDataUrl(file: File): Promise<string> {
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | null = null;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    objectUrl = URL.createObjectURL(file);
    source = await loadImage(objectUrl);
  }

  const iw = "width" in source ? source.width : (source as HTMLImageElement).naturalWidth;
  const ih = "height" in source ? source.height : (source as HTMLImageElement).naturalHeight;
  const scale = Math.min(1, MAX_SOURCE_EDGE / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  if ("close" in source) source.close();
  if (objectUrl) URL.revokeObjectURL(objectUrl);

  const url = canvas.toDataURL(OUT_TYPE, 0.92);
  // A blank/failed decode yields a suspiciously tiny data URL — treat as error.
  if (url.length < 128) throw new Error("decode produced empty image");
  return url;
}

function ImageCropper({ initialSrc, aspect, maxEdge, rounded, isAr, onCancel, onConfirm }: CropperProps) {
  const FRAME_W = aspect >= 1 ? 300 : 300 * aspect;
  const FRAME_H = aspect >= 1 ? 300 / aspect : 300;

  const [src, setSrc] = React.useState(initialSrc);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = React.useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [rendering, setRendering] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    loadImage(src).then((img) => {
      if (cancelled) return;
      imgRef.current = img;
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  const baseScale = nat ? Math.max(FRAME_W / nat.w, FRAME_H / nat.h) : 1;
  const dispW = nat ? nat.w * baseScale * zoom : 0;
  const dispH = nat ? nat.h * baseScale * zoom : 0;

  const clamp = React.useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(FRAME_W - dispW, x)),
      y: Math.min(0, Math.max(FRAME_H - dispH, y)),
    }),
    [FRAME_W, FRAME_H, dispW, dispH]
  );

  React.useEffect(() => {
    if (!nat) return;
    setOffset(clamp((FRAME_W - dispW) / 2, (FRAME_H - dispH) / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat, zoom]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOffset(clamp(drag.current.ox + (e.clientX - drag.current.x), drag.current.oy + (e.clientY - drag.current.y)));
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function rotate() {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    setNat(null);
    setSrc(canvas.toDataURL("image/png"));
  }

  async function confirm() {
    if (!nat || !imgRef.current) return;
    setRendering(true);
    try {
      const outW = aspect >= 1 ? maxEdge : Math.round(maxEdge * aspect);
      const outH = aspect >= 1 ? Math.round(maxEdge / aspect) : maxEdge;
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      const scale = baseScale * zoom;
      ctx.drawImage(imgRef.current, -offset.x / scale, -offset.y / scale, FRAME_W / scale, FRAME_H / scale, 0, 0, outW, outH);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, OUT_TYPE, OUT_QUALITY));
      if (blob) onConfirm(blob);
    } finally {
      setRendering(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? "قص الصورة" : "Crop photo"}
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-e3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">{isAr ? "اضبط الصورة" : "Position photo"}</h3>
          <button onClick={onCancel} aria-label={isAr ? "إلغاء" : "Cancel"} className="rounded-full p-1 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div
          className="relative mx-auto touch-none overflow-hidden bg-muted"
          style={{ width: FRAME_W, height: FRAME_H, borderRadius: rounded ? "9999px" : "1rem" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {nat ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none max-w-none select-none"
              style={{ position: "absolute", left: offset.x, top: offset.y, width: dispW, height: dispH }}
            />
          ) : (
            <span className="grid size-full place-items-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </span>
          )}
          <span
            className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/40"
            style={{ borderRadius: rounded ? "9999px" : "1rem" }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label={isAr ? "تكبير" : "Zoom"}
            className="h-1.5 w-full cursor-pointer accent-primary"
          />
          <button
            onClick={rotate}
            aria-label={isAr ? "تدوير" : "Rotate"}
            title={isAr ? "تدوير" : "Rotate"}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border hover:bg-muted"
          >
            <RotateCw className="size-4" />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button size="sm" onClick={confirm} disabled={!nat || rendering}>
            {rendering ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {isAr ? "حفظ" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
