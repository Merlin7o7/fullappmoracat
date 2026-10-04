"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Download, Share2, X } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
import { IS_IOS, canShareFile, downloadFile, renderStoryFile } from "@/lib/card-export";
import { trackCardShared } from "@/lib/track-once";

/**
 * Sharing a story image that actually works on iPhone.
 *
 * Safari only allows `navigator.share` (and downloads) inside a fresh tap. The
 * capture takes seconds on an iPhone, so "tap → render → share" silently fails
 * there: the tap is spent before the share sheet is asked for. So:
 *
 *   1. `prerender` renders the image ahead of time (the profile's Cat ID
 *      share) — then a single tap opens the share sheet immediately.
 *   2. Otherwise the first tap renders, and the image opens in a preview
 *      sheet whose own Share button is a fresh tap → the native share sheet
 *      (Instagram, WhatsApp, "Save Image"). Long-press on the image also saves
 *      it to Photos on iOS. Desktops get a real download.
 *
 * Off iOS we still try to share straight after rendering (Android Chrome
 * allows a few seconds); if the browser refuses, the preview sheet catches it.
 */
export function useStoryShare({
  nodeRef,
  baseName,
  shareText,
  isAr,
  prerender = false,
  cacheKey,
  attribution,
}: {
  nodeRef: React.RefObject<HTMLElement>;
  baseName: string;
  shareText: string;
  isAr: boolean;
  /** Render ahead of time so one tap is enough (use for one prominent button per page). */
  prerender?: boolean;
  /** Anything that changes the artwork (name, photo…) — a new key drops the cached image. */
  cacheKey: string;
  /** `card_shared` dimensions, sent once the image actually leaves (share or save). */
  attribution?: { src: string; kind: string };
}) {
  const { toast } = useToast();
  const cache = React.useRef<{ key: string; file: File; url: string } | null>(null);
  const pending = React.useRef<Promise<{ file: File; url: string } | null> | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [sheet, setSheet] = React.useState<{ file: File; url: string } | null>(null);

  const prepare = React.useCallback(async () => {
    if (cache.current?.key === cacheKey) return cache.current;
    if (pending.current) return pending.current;
    const node = nodeRef.current;
    if (!node) return null;
    const run = (async () => {
      const file = await renderStoryFile(node, baseName);
      const url = URL.createObjectURL(file);
      if (cache.current) URL.revokeObjectURL(cache.current.url);
      cache.current = { key: cacheKey, file, url };
      return cache.current;
    })();
    pending.current = run;
    try {
      return await run;
    } finally {
      pending.current = null;
    }
  }, [baseName, cacheKey, nodeRef]);

  // Drop a stale render when the artwork changes; pre-render when asked.
  React.useEffect(() => {
    if (cache.current && cache.current.key !== cacheKey) {
      URL.revokeObjectURL(cache.current.url);
      cache.current = null;
    }
    if (!prerender) return;
    const t = window.setTimeout(() => void prepare().catch(() => undefined), 1500);
    return () => window.clearTimeout(t);
  }, [cacheKey, prerender, prepare]);

  React.useEffect(() => () => { if (cache.current) URL.revokeObjectURL(cache.current.url); }, []);

  const fail = React.useCallback(() => {
    toast({ title: isAr ? "تعذّر تجهيز الصورة" : "Couldn't prepare the image", description: isAr ? "جرّب مرة ثانية بعد لحظات" : "Give it another try in a moment", variant: "error" });
  }, [isAr, toast]);

  const src = attribution?.src;
  const kind = attribution?.kind;
  const delivered = React.useCallback(
    (how: string) => { if (src) trackCardShared(src, kind ?? "story", { via: how }); },
    [src, kind]
  );

  /** Hand a ready image to the platform. Call ONLY inside a tap handler. */
  const deliver = React.useCallback(
    (img: { file: File; url: string }) => {
      if (canShareFile(img.file)) {
        navigator.share({ files: [img.file], text: shareText }).then(() => delivered("share")).catch((err: Error) => {
          if (err?.name === "AbortError") return; // closed the sheet — a decision, not a failure
          setSheet(img); // refused (e.g. tap expired) → the preview has its own fresh tap
        });
        return;
      }
      if (IS_IOS) {
        setSheet(img); // long-press to save
        return;
      }
      downloadFile(img.file);
      delivered("download");
      toast({ title: isAr ? "حفظنا الصورة لك" : "Image saved", description: isAr ? "شاركها من الصور أو انستقرام." : "Share it from your photos or Instagram.", variant: "success" });
    },
    [delivered, isAr, shareText, toast]
  );

  const share = React.useCallback(() => {
    const ready = cache.current?.key === cacheKey ? cache.current : null;
    if (ready) {
      deliver(ready); // still inside the tap → the share sheet opens
      return;
    }
    setBusy(true);
    prepare()
      .then((img) => {
        if (!img) return;
        // iPhones never allow sharing this late — go straight to the sheet.
        if (IS_IOS) setSheet(img);
        else deliver(img);
      })
      .catch(fail)
      .finally(() => setBusy(false));
  }, [cacheKey, deliver, fail, prepare]);

  const sheetEl = sheet ? (
    <StoryPreviewSheet file={sheet.file} url={sheet.url} shareText={shareText} isAr={isAr} onClose={() => setSheet(null)} onDelivered={delivered} />
  ) : null;

  return { share, busy, sheet: sheetEl };
}

export function StoryPreviewSheet({
  file,
  url,
  shareText,
  isAr,
  onClose,
  onDelivered,
}: {
  file: File;
  url: string;
  shareText: string;
  isAr: boolean;
  onClose: () => void;
  /** Called when the image really left — shared, or downloaded. */
  onDelivered?: (how: string) => void;
}) {
  const canShare = canShareFile(file);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? "صورتك جاهزة" : "Your image is ready"}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-card p-5 shadow-e3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={isAr ? "إغلاق" : "Close"}
          className="absolute end-3 top-3 grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-5" />
        </button>
        <p className="mt-1 font-medium">{isAr ? "صورتك جاهزة" : "Your image is ready"}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={isAr ? "صورة المشاركة" : "Share image"} className="max-h-[58vh] w-auto rounded-2xl shadow-e2" />
        {canShare ? (
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              navigator.share({ files: [file], text: shareText }).then(() => { onDelivered?.("share"); onClose(); }).catch((err: Error) => {
                if (err?.name !== "AbortError") onClose();
              });
            }}
          >
            <Share2 className="size-4" /> {isAr ? "شارك أو احفظ" : "Share or save"}
          </Button>
        ) : !IS_IOS ? (
          <Button size="lg" className="w-full" onClick={() => { downloadFile(file); onDelivered?.("download"); onClose(); }}>
            <Download className="size-4" /> {isAr ? "حمّل الصورة" : "Download the image"}
          </Button>
        ) : null}
        {IS_IOS && (
          <p className="text-center text-sm text-muted-foreground">
            {isAr ? "أو اضغط مطولاً على الصورة واختر «حفظ في الصور»." : "Or press and hold the image and choose “Save to Photos”."}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
