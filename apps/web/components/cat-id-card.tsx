"use client";

import { PawPrint } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@moraqat/ui";
import { localizeName } from "@/lib/translit";

interface CatIdCardProps {
  catName: string;
  catIdNumber: string;
  issuedAt?: string | null;
  photoUrl?: string | null;
  isAr: boolean;
  /** A not-yet-issued preview (e.g. the landing hero) — honest labelling (R040). */
  preview?: boolean;
  /** Membership standing — drives the Active/Inactive indicator (#5, #9). */
  membershipActive?: boolean;
  // ── Detailed membership-card fields (#5) ──
  detailed?: boolean;
  ownerName?: string | null;
  ownerPhone?: string | null;
  breed?: string | null;
  favoriteFood?: string | null;
  /** Opaque QR verification token (#2) — encoded as `MRCV1:<token>`, never a URL. */
  qrToken?: string | null;
  className?: string;
}

/**
 * The Cat ID — the membership made tangible (Dossier §05). Designed like an
 * object, not a UI panel: quiet, precise, proud (R035). The QR is a secure
 * in-ecosystem token, not a public link (#2). In `detailed` mode it becomes the
 * full membership card (#5): owner, breed, favourite food, status, QR.
 */
export function CatIdCard({
  catName, catIdNumber, issuedAt, photoUrl, isAr, preview,
  membershipActive, detailed, ownerName, ownerPhone, breed, favoriteFood, qrToken, className,
}: CatIdCardProps) {
  const since = issuedAt
    ? new Date(issuedAt).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { month: "short", year: "numeric" })
    : null;
  const qrValue = qrToken ? `MRCV1:${qrToken}` : null;
  const loc = isAr ? "ar" : "en";
  const dispName = localizeName(catName, loc);
  const dispOwner = ownerName ? localizeName(ownerName, loc) : ownerName;

  return (
    <div
      role="img"
      aria-label={
        isAr ? `هوية القط: ${dispName}، الرقم ${catIdNumber}` : `Cat ID for ${dispName}, number ${catIdNumber}`
      }
      className={cn(
        "relative w-full max-w-sm select-none overflow-hidden rounded-2xl p-5 text-white shadow-e3 ring-hairline",
        !detailed && "aspect-[1.586]",
        "bg-[linear-gradient(135deg,hsl(166_82%_16%),hsl(168_80%_10%)_55%,hsl(170_74%_6%))]",
        className
      )}
    >
      {/* Quiet watermark — the seal, not a sticker. */}
      <PawPrint aria-hidden className="absolute -bottom-7 -end-7 size-36 rotate-[-12deg] text-white/[0.06]" strokeWidth={1.2} />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent" />

      <div className="relative flex h-full flex-col justify-between gap-4">
        {/* Header: brand + status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
              <PawPrint className="size-3.5 text-[hsl(18_93%_60%)]" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">
              {isAr ? "مرقط · عضوية" : "Moracat · Member"}
            </span>
          </div>
          {!preview && <StatusPill active={!!membershipActive} isAr={isAr} />}
          {preview && (
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(18_93%_60%)]">
              {isAr ? "معاينة" : "Preview"}
            </span>
          )}
        </div>

        {/* Identity: photo + name */}
        <div className="flex items-center gap-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className={cn("rounded-full object-cover ring-2 ring-white/25", detailed ? "size-14" : "size-10")} />
          ) : (
            <span aria-hidden className={cn("grid place-items-center rounded-full bg-white/[0.07] ring-1 ring-white/15", detailed ? "size-14" : "size-10")}>
              <PawPrint className="size-5 text-white/40" />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-display text-[clamp(1.35rem,6cqw,1.9rem)] font-semibold leading-tight tracking-tight">{dispName}</p>
            {since && <p className="mt-0.5 text-[11px] text-white/55">{isAr ? `عضو من ${since}` : `Member since ${since}`}</p>}
          </div>
        </div>

        {/* Detailed fields (#5) */}
        {detailed && (
          <div className="flex items-end justify-between gap-3">
            <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-[11px] leading-tight">
              <Detail label={isAr ? "المالك" : "Owner"} value={dispOwner} />
              <Detail label={isAr ? "الجوال" : "Mobile"} value={ownerPhone} mono />
              <Detail label={isAr ? "الفصيلة" : "Breed"} value={breed} />
              <Detail label={isAr ? "الطعام المفضّل" : "Favourite food"} value={favoriteFood} />
            </dl>
            {qrValue && (
              <div className="shrink-0 rounded-lg bg-white p-1.5">
                <QRCodeSVG value={qrValue} size={64} level="M" bgColor="#ffffff" fgColor="#0b3b30" />
              </div>
            )}
          </div>
        )}

        {/* Footer: Cat ID number */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/40">{isAr ? "رقم الهوية" : "Cat ID"}</p>
            <p className="font-mono text-sm tracking-[0.18em] text-white/90 tabular" dir="ltr">{catIdNumber}</p>
          </div>
          {!detailed && !preview && qrValue && (
            <div className="shrink-0 rounded-lg bg-white p-1">
              <QRCodeSVG value={qrValue} size={44} level="M" bgColor="#ffffff" fgColor="#0b3b30" />
            </div>
          )}
          {!qrValue && (
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(18_93%_60%)]">
              {preview ? (isAr ? "معاينة" : "Preview") : isAr ? "هوية رسمية" : "Official ID"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ active, isAr }: { active: boolean; isAr: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] ring-1",
        active ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30" : "bg-white/10 text-white/60 ring-white/20"
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-emerald-300" : "bg-white/40")} />
      {active ? (isAr ? "فعّالة" : "Active") : isAr ? "غير مفعّلة" : "Inactive"}
    </span>
  );
}

function Detail({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[8px] uppercase tracking-[0.15em] text-white/40">{label}</dt>
      <dd className={cn("truncate text-white/85", mono && "font-mono tabular")} dir={mono ? "ltr" : undefined}>
        {value || "—"}
      </dd>
    </div>
  );
}
