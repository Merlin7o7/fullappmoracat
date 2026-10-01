"use client";

import * as React from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button, useToast, type ButtonProps } from "@moraqat/ui";
import { exportSafeSrc, shareStoryPng } from "@/lib/card-export";
import { MomentPoster, type MomentKind } from "./moment-poster";

/**
 * Share a moment as an image, not a bare link (W6/W9 "shareable moments"):
 * a lost-cat poster for the neighbourhood's WhatsApp groups, a reunion, an
 * adoption, a birthday. The poster renders off-screen and is captured with the
 * same pipeline as the ID story; phones get the native share sheet with the
 * PNG attached, desktops a download.
 */
export function MomentShare({
  kind,
  isAr,
  catName,
  photoUrl,
  catIdNumber,
  lines,
  qrUrl,
  shareText,
  label,
  variant = "secondary",
  size = "sm",
  className,
}: {
  kind: MomentKind;
  isAr: boolean;
  catName: string;
  photoUrl: string | null;
  catIdNumber?: string | null;
  lines?: string[];
  qrUrl?: string | null;
  shareText: string;
  label: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [safePhoto, setSafePhoto] = React.useState<string | null>(null);
  React.useEffect(() => setSafePhoto(exportSafeSrc(photoUrl)), [photoUrl]);

  async function share() {
    if (!ref.current) return;
    setBusy(true);
    try {
      const outcome = await shareStoryPng(ref.current, `Moracat-${kind}-${catName}`, shareText);
      if (outcome === "downloaded") {
        toast({ title: isAr ? "حفظنا الصورة لك" : "Image saved", description: isAr ? "شاركها من معرض الصور." : "Share it from your photos.", variant: "success" });
      }
    } catch {
      toast({ title: isAr ? "تعذّر تجهيز الصورة" : "Couldn't prepare the image", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={share} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
        {label}
      </Button>
      {/* Off-screen, clipped to a zero box at the origin (no RTL scroll overflow). */}
      <div aria-hidden dir="ltr" className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden" style={{ zIndex: -1 }}>
        <div style={{ width: 540 }}>
          <MomentPoster ref={ref} kind={kind} isAr={isAr} catName={catName} photoUrl={safePhoto} catIdNumber={catIdNumber} lines={lines} qrUrl={qrUrl} />
        </div>
      </div>
    </>
  );
}
