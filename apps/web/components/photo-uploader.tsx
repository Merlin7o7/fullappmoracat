"use client";

// ════════════════════════════════════════════════════════════════════════
//  PhotoUploader — drag & drop, tap-to-choose (incl. mobile camera/gallery),
//  interactive crop (pan + zoom), and client-side compression to WebP before
//  upload. Dependency-free: cropping + resizing done on a <canvas>. The parent
//  supplies onUpload(blob); this component owns the pick → crop → compress UX.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { Camera, ImageUp, Loader2, X, ZoomIn, Check } from "lucide-react";
import { Button, cn, useToast } from "@moraqat/ui";

export interface PhotoUploaderProps {
  /** width / height of the crop frame + output (e.g. 1 for square, 16/9 cover). */
  aspect?: number;
  /** Longest output edge in px (the other follows from aspect). */
  maxEdge?: number;
  /** Round the preview + frame (profile avatars). */
  rounded?: boolean;
  /** Existing image to show as the current state. */
  currentUrl?: string | null;
  label?: string;
  hint?: string;
  isAr?: boolean;
  /** Receives the cropped, compressed WebP blob. Should persist + resolve. */
  onUpload: (blob: Blob) => Promise<void>;
}

const JPEG_OR_WEBP = "image/webp";

export function PhotoUploader({
  aspect = 1,
  maxEdge = 900,
  rounded = false,
  currentUrl,
  label,
  hint,
  isAr = false,
  onUpload,
}: PhotoUploaderProps) {
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [src, setSrc] = React.useState<string | null>(null); // data URL being cropped
  const [dragOver, setDragOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  function pickFile(file: File | undefined | null) {
    if (!file) return;
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) {
      toast({ title: isAr ? "الصور فقط (JPEG / PNG / WebP)" : "Images only (JPEG / PNG / WebP)", variant: "error" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: isAr ? "الصورة كبيرة جداً" : "That image is too large", variant: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleCropped(blob: Blob) {
    setSrc(null);
    setBusy(true);
    try {
      await onUpload(blob);
      toast({ title: isAr ? "تم رفع الصورة" : "Photo uploaded", variant: "success" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : isAr ? "فشل الرفع" : "Upload failed", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

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
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        aria-label={label || (isAr ? "رفع صورة" : "Upload photo")}
        className={cn(
          "group relative flex cursor-pointer items-center gap-4 overflow-hidden border border-dashed p-3 transition-colors",
          rounded ? "rounded-full" : "rounded-2xl",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
        )}
      >
        <span
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden bg-muted",
            rounded ? "size-16 rounded-full" : "size-16 rounded-xl"
          )}
          style={aspect !== 1 && !rounded ? { aspectRatio: String(aspect), width: 96, height: "auto" } : undefined}
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="" className="size-full object-cover" />
          ) : (
            <Camera className="size-6 text-muted-foreground" />
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-background/70">
              <Loader2 className="size-5 animate-spin text-primary" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <ImageUp className="size-4 text-primary" />
            {currentUrl ? (isAr ? "تغيير الصورة" : "Change photo") : isAr ? "أضف صورة" : "Add a photo"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hint ?? (isAr ? "اسحب وأفلت، أو اضغط للاختيار" : "Drag & drop, or tap to choose")}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = ""; // allow re-picking the same file
        }}
      />

      {src && (
        <ImageCropper
          src={src}
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

// ── Cropper modal ───────────────────────────────────────────────────────────

interface CropperProps {
  src: string;
  aspect: number;
  maxEdge: number;
  rounded: boolean;
  isAr: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

function ImageCropper({ src, aspect, maxEdge, rounded, isAr, onCancel, onConfirm }: CropperProps) {
  const FRAME_W = aspect >= 1 ? 300 : 300 * aspect;
  const FRAME_H = aspect >= 1 ? 300 / aspect : 300;

  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = React.useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const drag = React.useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [rendering, setRendering] = React.useState(false);

  // Load intrinsic size.
  React.useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
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

  // Re-center / re-clamp when zoom or image changes.
  React.useEffect(() => {
    if (!nat) return;
    setOffset(() => clamp((FRAME_W - dispW) / 2, (FRAME_H - dispH) / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat, zoom]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.x);
    const ny = drag.current.oy + (e.clientY - drag.current.y);
    setOffset(clamp(nx, ny));
  }
  function onPointerUp() {
    drag.current = null;
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
      // Map the frame back to source pixels.
      const scale = baseScale * zoom;
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = FRAME_W / scale;
      const sh = FRAME_H / scale;
      ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, outW, outH);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, JPEG_OR_WEBP, 0.85)
      );
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
          {nat && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none max-w-none select-none"
              style={{
                position: "absolute",
                left: offset.x,
                top: offset.y,
                width: dispW,
                height: dispH,
              }}
            />
          )}
          <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/40" style={{ borderRadius: rounded ? "9999px" : "1rem" }} />
        </div>

        <div className="mt-4 flex items-center gap-2">
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
