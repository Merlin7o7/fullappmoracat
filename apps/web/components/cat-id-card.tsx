"use client";

import { PawPrint, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@moraqat/ui";
import { localizeName } from "@/lib/translit";
import { commerceEnabled } from "@/lib/features";

interface CatIdCardProps {
  catName: string;
  catIdNumber: string;
  issuedAt?: string | null;
  photoUrl?: string | null;
  /** Optional cover/backdrop — a faint wash behind the card (community era). */
  coverUrl?: string | null;
  isAr: boolean;
  /** A not-yet-issued preview (e.g. the landing hero) — honest labelling (R040). */
  preview?: boolean;
  /** Membership standing — drives the Active/Inactive/Coming-Soon indicator. */
  membershipActive?: boolean;
  /** The ceremony shows the identity, not the standing — the reveal is about
   *  who they are; activation follows one step later (R031). */
  hideStatus?: boolean;
  /** Opt-in subtle motion (hero/ceremony). Off by default so exports stay static. */
  animated?: boolean;
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
 * The Cat ID — the membership made tangible (Dossier §05). Built like a luxury
 * credential: deep-jade field, a brushed gold-foil edge, an iridescent
 * holographic sheen, guilloché security lines, and a passport-style ID chip.
 * Quiet, precise, proud (R035) — something a member genuinely wants to share.
 * The QR is a secure in-ecosystem token, never a public link (#2).
 */
export function CatIdCard({
  catName, catIdNumber, issuedAt, photoUrl, coverUrl, isAr, preview, hideStatus,
  membershipActive, animated, detailed, ownerName, ownerPhone, breed, favoriteFood, qrToken, className,
}: CatIdCardProps) {
  const since = issuedAt
    ? new Date(issuedAt).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { month: "short", year: "numeric" })
    : null;
  const qrValue = qrToken ? `MRCV1:${qrToken}` : null;
  const loc = isAr ? "ar" : "en";
  const dispName = localizeName(catName, loc);
  const dispOwner = ownerName ? localizeName(ownerName, loc) : ownerName;
  // Before launch every membership is "Coming Soon"; after, inactive means lapsed.
  const comingSoon = !membershipActive && !commerceEnabled();

  return (
    // Brushed gold-foil edge — the metallic border of a passport / premium card.
    <div
      className={cn(
        "group relative w-full max-w-sm rounded-[1.3rem] p-[1.5px] shadow-e3",
        "bg-[linear-gradient(140deg,rgba(240,225,190,0.55),rgba(191,155,90,0.35)_20%,rgba(255,255,255,0.06)_44%,rgba(255,255,255,0.03)_60%,rgba(191,155,90,0.30)_82%,rgba(240,225,190,0.5))]",
        className
      )}
    >
      <div
        role="img"
        aria-label={
          isAr ? `هوية القط: ${dispName}، الرقم ${catIdNumber}` : `Cat ID for ${dispName}, number ${catIdNumber}`
        }
        className={cn(
          "relative isolate overflow-hidden rounded-[1.2rem] p-5 text-white",
          !detailed && "aspect-[1.586]",
          "bg-[radial-gradient(125%_125%_at_0%_0%,hsl(168_72%_18%),hsl(169_82%_11%)_46%,hsl(174_82%_5%))]"
        )}
      >
        {/* Optional cover wash — the cat's world, barely there. */}
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" aria-hidden className="absolute inset-0 -z-10 size-full object-cover opacity-[0.14]" />
        )}
        {/* Guilloché security lines — fine engraving, like a banknote. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg,rgba(255,255,255,0.045) 0 1px,transparent 1px 7px),repeating-linear-gradient(65deg,rgba(255,255,255,0.03) 0 1px,transparent 1px 9px)",
          }}
        />
        {/* Iridescent holographic sheen — shifts gently on hover (subtle motion). */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-x-10 -inset-y-4 -z-10 translate-x-0 transition-transform duration-700 ease-out",
            animated && "group-hover:translate-x-6"
          )}
          style={{
            backgroundImage:
              "linear-gradient(115deg,transparent 26%,hsla(20,90%,66%,0.12),hsla(280,80%,72%,0.10),hsla(190,90%,70%,0.11),transparent 72%)",
          }}
        />
        {/* Top light + quiet paw seal. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-white/[0.09] to-transparent" />
        <PawPrint aria-hidden className="pointer-events-none absolute -bottom-8 -end-8 -z-10 size-40 rotate-[-12deg] text-white/[0.05]" strokeWidth={1.1} />

        <div className="relative flex h-full flex-col justify-between gap-4">
          {/* Header: foil seal + wordmark + standing */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className="grid size-8 place-items-center rounded-full ring-1 ring-white/25"
                style={{ backgroundImage: "conic-gradient(from 210deg,rgba(240,225,190,0.9),rgba(191,155,90,0.5),rgba(255,255,255,0.85),rgba(191,155,90,0.5),rgba(240,225,190,0.9))" }}
              >
                <PawPrint className="size-4 text-[hsl(170_82%_12%)]" strokeWidth={2.2} />
              </span>
              <div className="leading-none">
                <span className="block font-mono text-[10px] uppercase tracking-[0.24em] text-white/80">
                  {isAr ? "مرقط" : "Moracat"}
                </span>
                <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.28em] text-[hsl(42_60%_74%)]">
                  {isAr ? "عضوية" : "Membership"}
                </span>
              </div>
            </div>

            {preview ? (
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(42_60%_74%)]">
                {isAr ? "معاينة" : "Preview"}
              </span>
            ) : (
              !hideStatus && (
                <div className="flex flex-col items-end gap-1">
                  <StatusPill active={!!membershipActive} comingSoon={comingSoon} isAr={isAr} />
                  {comingSoon && (
                    <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-[hsl(42_60%_72%)]">
                      {isAr ? "قريباً" : "Coming soon"}
                    </span>
                  )}
                </div>
              )
            )}
          </div>

          {/* Identity: portrait + name */}
          <div className="flex items-center gap-3.5">
            <span
              className={cn(
                "relative shrink-0 rounded-full p-[2px]",
                detailed ? "size-16" : "size-12"
              )}
              style={{ backgroundImage: "linear-gradient(140deg,rgba(240,225,190,0.8),rgba(191,155,90,0.35),rgba(255,255,255,0.5))" }}
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="size-full rounded-full object-cover" />
              ) : (
                <span aria-hidden className="grid size-full place-items-center rounded-full bg-[hsl(170_60%_9%)]">
                  <PawPrint className="size-5 text-white/45" />
                </span>
              )}
            </span>
            <div className="min-w-0">
              <p className="font-display text-[clamp(1.4rem,6cqw,2rem)] font-semibold leading-tight tracking-tight">
                {dispName}
              </p>
              {since && (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">
                  {isAr ? `عضو منذ ${since}` : `Member since ${since}`}
                </p>
              )}
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
              {qrValue && <QrTile value={qrValue} isAr={isAr} size={64} />}
            </div>
          )}

          {/* Footer: passport-style ID chip + QR / seal */}
          <div className="flex items-end justify-between gap-3">
            <div
              className="rounded-lg px-2.5 py-1.5 ring-1 ring-white/12"
              style={{ backgroundImage: "linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))" }}
            >
              <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-[hsl(42_55%_70%)]">
                {isAr ? "رقم الهوية" : "Cat ID"}
              </p>
              <p className="mt-0.5 font-mono text-sm tracking-[0.2em] text-white tabular" dir="ltr">
                {catIdNumber}
              </p>
            </div>

            {!detailed && !preview && qrValue ? (
              <QrTile value={qrValue} isAr={isAr} size={46} />
            ) : (
              !qrValue &&
              !preview && (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[hsl(42_60%_74%)]">
                  <ShieldCheck className="size-3.5" />
                  {isAr ? "هوية رسمية" : "Official ID"}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** White QR tile with a gold hairline + micro-label — the "scan me" moment. */
function QrTile({ value, size, isAr }: { value: string; size: number; isAr: boolean }) {
  return (
    <div className="shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-[rgba(191,155,90,0.5)]">
      <QRCodeSVG value={value} size={size} level="M" bgColor="#ffffff" fgColor="#0b3b30" />
      <p className="mt-0.5 text-center font-mono text-[6px] uppercase tracking-[0.16em] text-[hsl(170_60%_22%)]">
        {isAr ? "تحقّق" : "Verify"}
      </p>
    </div>
  );
}

function StatusPill({ active, comingSoon, isAr }: { active: boolean; comingSoon: boolean; isAr: boolean }) {
  // Gold when "coming soon", jade-green when active, muted when lapsed-inactive.
  const tone = active
    ? "bg-[hsla(150,60%,45%,0.16)] text-[hsl(150_60%_82%)] ring-[hsla(150,60%,60%,0.35)]"
    : comingSoon
      ? "bg-[hsla(42,70%,55%,0.14)] text-[hsl(42_65%_78%)] ring-[hsla(42,65%,60%,0.35)]"
      : "bg-white/10 text-white/60 ring-white/20";
  const dot = active ? "bg-[hsl(150_60%_60%)]" : comingSoon ? "bg-[hsl(42_75%_62%)]" : "bg-white/40";
  const label = active
    ? isAr ? "فعّالة" : "Active"
    : isAr ? "غير مفعّلة" : "Inactive";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] ring-1", tone)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}

function Detail({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[8px] uppercase tracking-[0.15em] text-[hsl(42_45%_66%)]">{label}</dt>
      <dd className={cn("truncate text-white/85", mono && "font-mono tabular")} dir={mono ? "ltr" : undefined}>
        {value || "—"}
      </dd>
    </div>
  );
}
