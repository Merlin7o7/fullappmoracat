"use client";

import { PawPrint } from "lucide-react";
import { cn } from "@moraqat/ui";

interface CatIdCardProps {
  catName: string;
  catIdNumber: string;
  issuedAt?: string | null;
  photoUrl?: string | null;
  isAr: boolean;
  className?: string;
}

/**
 * The Cat ID — the membership made tangible (Dossier §05).
 * Designed like an object, not a UI panel: quiet, precise, proud (R035).
 * Pure CSS/SVG so it renders instantly and offline (R036 groundwork).
 */
export function CatIdCard({ catName, catIdNumber, issuedAt, photoUrl, isAr, className }: CatIdCardProps) {
  const since = issuedAt
    ? new Date(issuedAt).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { month: "short", year: "numeric" })
    : null;

  return (
    <div
      role="img"
      aria-label={
        isAr
          ? `هوية القط: ${catName}، الرقم ${catIdNumber}`
          : `Cat ID for ${catName}, number ${catIdNumber}`
      }
      className={cn(
        "relative aspect-[1.586] w-full max-w-sm select-none overflow-hidden rounded-2xl p-5 text-white shadow-e3 ring-hairline",
        "bg-[linear-gradient(135deg,hsl(187_74%_22%),hsl(193_60%_14%)_55%,hsl(200_45%_10%))]",
        className
      )}
    >
      {/* Quiet watermark — the seal, not a sticker. */}
      <PawPrint
        aria-hidden
        className="absolute -bottom-7 -end-7 size-36 rotate-[-12deg] text-white/[0.06]"
        strokeWidth={1.2}
      />
      {/* Top-light sheen for the "object" feel. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
              <PawPrint className="size-3.5 text-[hsl(32_92%_62%)]" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">
              {isAr ? "مرقط · عضوية" : "Moraqat · Member"}
            </span>
          </div>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="size-10 rounded-full object-cover ring-2 ring-white/25" />
          ) : (
            <span aria-hidden className="grid size-10 place-items-center rounded-full bg-white/[0.07] ring-1 ring-white/15">
              <PawPrint className="size-4 text-white/40" />
            </span>
          )}
        </div>

        <div>
          <p className="font-display text-[clamp(1.5rem,6cqw,2rem)] font-semibold leading-tight tracking-tight">
            {catName}
          </p>
          {since && (
            <p className="mt-0.5 text-[11px] text-white/55">
              {isAr ? `عضو منذ ${since}` : `Member since ${since}`}
            </p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <p className="font-mono text-sm tracking-[0.18em] text-white/90 tabular" dir="ltr">
            {catIdNumber}
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(32_92%_62%)]">
            {isAr ? "هوية رسمية" : "Official ID"}
          </p>
        </div>
      </div>
    </div>
  );
}
