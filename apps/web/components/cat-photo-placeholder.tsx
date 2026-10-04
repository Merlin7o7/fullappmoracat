import * as React from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { cn } from "@moraqat/ui";

/**
 * Where a real cat's photo will go — and nothing pretends to be that cat.
 *
 * Audit MRC-UX-AUDIT-2026-10-04 Part 05 retired the pink plush 3D cat as a
 * placeholder: a toy at 300 px standing in for a member's own animal. This is
 * the replacement: a flat warm-paper frame, an emerald line silhouette (a
 * sitting cat, drawn once, no face, no colour of its own), and an invitation
 * that names the cat — «أضف صورة لولو». No motion, no 3D, works on any
 * surface including distress ones.
 *
 * API
 *   name       the cat's display name (already localised) — fills the label
 *   isAr       copy language
 *   href       makes the whole frame a link (e.g. the photo step)
 *   onClick    or a button (e.g. opens the uploader)
 *   label      override the invitation text, or `null` to hide it
 *   className  size/shape — defaults to a square that fills its box
 */
export interface CatPhotoPlaceholderProps {
  name?: string | null;
  isAr: boolean;
  href?: string;
  onClick?: () => void;
  label?: React.ReactNode | null;
  className?: string;
}

export function CatPhotoPlaceholder({ name, isAr, href, onClick, label, className }: CatPhotoPlaceholderProps) {
  const text =
    label === null
      ? null
      : label ?? (name ? (isAr ? `أضف صورة ${name}` : `Add a photo of ${name}`) : isAr ? "أضف صورة قطك" : "Add your cat's photo");
  const interactive = Boolean(href || onClick);

  const body = (
    <>
      <svg viewBox="0 0 120 120" aria-hidden className="h-[46%] w-auto text-primary/70" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        {/* A sitting cat in one emerald line: ears, head, back, tail curled to the front. */}
        <path d="M44 34 L47 18 L57 29 Q60 28 63 29 L73 18 L76 34 Q82 42 79 52 Q76 60 68 62 Q84 70 86 92 Q87 104 78 106 L42 106 Q33 104 34 92 Q36 70 52 62 Q44 60 41 52 Q38 42 44 34 Z" />
        <path d="M78 106 Q98 106 98 94 Q98 86 90 88" />
      </svg>
      {text && (
        <span className="flex items-center gap-1.5 px-3 text-center text-sm font-medium text-primary">
          {interactive && <Camera className="size-4 shrink-0" aria-hidden />}
          {text}
        </span>
      )}
    </>
  );

  const frame = cn(
    "flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-cream/60 dark:bg-cream/30",
    interactive && "transition-colors hover:border-primary/50 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className
  );

  if (href) return <Link href={href} className={frame}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={frame}>{body}</button>;
  return <div role="img" aria-label={typeof text === "string" ? text : isAr ? "لا توجد صورة بعد" : "No photo yet"} className={frame}>{body}</div>;
}
