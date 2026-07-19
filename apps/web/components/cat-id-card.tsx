"use client";

import type { CSSProperties } from "react";
import { ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@moraqat/ui";
import { isFoundingMember } from "@moraqat/core";
import { localizeName } from "@/lib/translit";
import { formatDate } from "@/lib/datetime";
import { commerceEnabled } from "@/lib/features";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloPaw } from "@/components/illustrations";

interface CatIdCardProps {
  catName: string;
  catIdNumber: string;
  /**
   * The census ordinal — this cat's real place in the national count
   * (MRC-GTM-001 §1). Drives the Founding Member mark, which is *derived* from
   * the number and can therefore never be granted, bought or faked (R006).
   * Absent on previews: we don't yet know what number a stranger would get,
   * and guessing would be a claim about a future we don't control (R040).
   */
  catNumber?: number | null;
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
  // ── Detailed membership-card fields ──
  detailed?: boolean;
  ownerName?: string | null;
  /** Shown as the emergency contact — the card's "bring my cat home" job (§05 job 1). */
  ownerPhone?: string | null;
  breed?: string | null;
  favoriteFood?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  vaccinationStatus?: string | null;
  /** Opaque QR verification token (#2) — encoded as `MRCV1:<token>`, never a URL. */
  qrToken?: string | null;
  /** Static export rendering — drops the drop-shadow so the captured PNG has no
   *  clipped shadow halo; geometry is identical (everything is sized in cqw). */
  exportMode?: boolean;
  // ── Personalisation (the keepsake layer) — all optional, all additive. The
  //    default (no props) renders the untouched classic green civic card. ──
  /** CSS background-image for the field; defaults to the classic deep green. */
  themeField?: string;
  /** Accent colour as raw "H S% L%" — a quiet signature hairline under the name. */
  accentHsl?: string;
  /** Frame treatment id (minimal / gold / neon / floral / birthday). */
  frame?: string;
  /** Owner-placed stickers, positioned as fractions of the card (LTR origin). */
  stickers?: { glyph: string; x: number; y: number; scale: number; rotate: number; flip?: boolean }[];
  className?: string;
}

/** The classic field — the brand's own deep-green civic chrome (the default). */
const CLASSIC_FIELD =
  "radial-gradient(130% 130% at 0% 0%,hsl(168 72% 19%),hsl(169 82% 11%) 52%,hsl(174 82% 6%))";

/** Frame → inset ring + optional corner glyphs. Insets (not outer glows) so the
 *  captured PNG never clips a halo (R034); neon reads as a bright inner ring. */
function frameStyle(frame: string | undefined, accentHsl: string): {
  boxShadow?: string;
  corners?: string[];
} {
  switch (frame) {
    case "minimal":
      return { boxShadow: "inset 0 0 0 0.5cqw hsl(0 0% 100% / 0.35)" };
    case "gold":
      return { boxShadow: "inset 0 0 0 1cqw hsl(43 74% 58%), inset 0 0 0 1.5cqw hsl(43 40% 28%)" };
    case "neon":
      return { boxShadow: `inset 0 0 0 0.8cqw hsl(${accentHsl}), inset 0 0 6cqw hsl(${accentHsl} / 0.55)` };
    case "floral":
      return { boxShadow: "inset 0 0 0 0.7cqw hsl(352 80% 80% / 0.7)", corners: ["🌸", "🌷", "🌿", "🌸"] };
    case "birthday":
      return { boxShadow: "inset 0 0 0 0.7cqw hsl(43 82% 62% / 0.8)", corners: ["🎈", "🎉", "🎂", "🎈"] };
    default:
      return {};
  }
}

/**
 * The Cat ID — the membership made tangible (Dossier §05). A civic credential
 * in the brand's own materials: a deep-green field over a warm-paper data band
 * (the passport MRZ, reimagined), guilloché engraving, an orange paw seal, and
 * the cat's name set large in the display face — the cat is the hero (R009).
 * Quietly premium through restraint — no gold, no glitter (Brand personality).
 *
 * Every dimension is in container-query units (cqw), so the card renders
 * pixel-proportionally identically at any width — portal rail, phone drawer,
 * or the fixed-width export node — and is locked to the physical ID-1 card
 * ratio (85.6 × 54 mm) in BOTH simple and detailed modes, so PNG/PDF/print
 * output can never crop or distort (R034).
 */
export function CatIdCard({
  catName, catIdNumber, catNumber, issuedAt, photoUrl, coverUrl, isAr, preview, hideStatus,
  membershipActive, animated, detailed, ownerName, ownerPhone, breed, favoriteFood,
  gender, birthDate, vaccinationStatus, qrToken, exportMode,
  themeField, accentHsl, frame, stickers, className,
}: CatIdCardProps) {
  const fieldBg = themeField || CLASSIC_FIELD;
  const frameFx = frameStyle(frame, accentHsl || "18 93% 62%");
  const since = issuedAt
    ? formatDate(issuedAt, isAr ? "ar" : "en", { month: "short", year: "numeric" })
    : null;
  const qrValue = qrToken ? `MRCV1:${qrToken}` : null;
  const loc = isAr ? "ar" : "en";
  const dispName = localizeName(catName, loc);
  const dispOwner = ownerName ? localizeName(ownerName, loc) : ownerName;
  // Before launch every membership is "Coming Soon"; after, inactive means lapsed.
  const comingSoon = !membershipActive && !commerceEnabled();
  // Founding standing is a restatement of the ordinal, computed here and never
  // passed in as a boolean — a caller cannot decorate a cat it didn't earn.
  const founding = !preview && isFoundingMember(catNumber);
  const ordinal = isAr ? `رقم ${catNumber}` : `#${catNumber}`;
  const age = birthDate ? ageLabel(birthDate, isAr) : null;
  const sex = genderLabel(gender, isAr);
  const meta = [sex, age, breed].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        // Radius matches the inner card (5cqw ≈ 1.2rem at the display size) so a
        // caller's box-shadow glow (shadow-glow) clips to the rounded card instead
        // of leaking as a rectangle behind it.
        "w-full max-w-sm rounded-[1.2rem] [container-type:inline-size]",
        !exportMode && "drop-shadow-[0_18px_36px_hsl(165_40%_14%/0.28)]",
        className
      )}
    >
      <div
        role="img"
        aria-label={
          isAr ? `هوية القط: ${dispName}، الرقم ${catIdNumber}` : `Cat ID for ${dispName}, number ${catIdNumber}`
        }
        className="relative isolate flex aspect-[85.6/54] flex-col overflow-hidden rounded-[5cqw]"
      >
        {/* ── The field — the brand's chrome, deep and calm (themeable) ── */}
        <div
          className="relative flex min-h-0 flex-1 flex-col justify-between px-[5.5cqw] pb-[3cqw] pt-[3.4cqw] text-white"
          style={{ backgroundImage: fieldBg }}
        >
          {/* Optional cover wash — the cat's world, barely there. */}
          {coverUrl && (
            <ImgWithFallback
              src={coverUrl}
              alt=""
              className="absolute inset-0 -z-10 size-full object-cover opacity-[0.14]"
              fallback={<></>}
            />
          )}
          {/* Guilloché engraving — banknote craft, scaled with the card. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-50"
            style={{
              backgroundImage:
                "repeating-linear-gradient(115deg,rgba(255,255,255,0.045) 0 0.25cqw,transparent 0.25cqw 1.7cqw),repeating-linear-gradient(65deg,rgba(255,255,255,0.03) 0 0.25cqw,transparent 0.25cqw 2.1cqw)",
            }}
          />
          {/* Soft light sweep — shifts gently on hover when animated. */}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 -z-10 transition-transform duration-700 ease-out",
              animated && "group-hover:translate-x-[3cqw]"
            )}
            style={{
              backgroundImage:
                "linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.07) 46%,rgba(255,255,255,0.03) 55%,transparent 70%)",
            }}
          />
          {/* Top light + quiet brand-paw watermark (the illustration set, not a stock glyph). */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent" />
          <IlloPaw
            tone="butter"
            aria-hidden
            className="pointer-events-none absolute -end-[5cqw] top-[6cqw] -z-10 size-[32cqw] rotate-[14deg] opacity-[0.06]"
          />

          {/* Header: the brand lockup (مرقط / Moracat) + standing. The document
              type ("Cat ID") lives on the paper band — no duplicate eyebrow. */}
          <div className="flex items-start justify-between gap-[3cqw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/moracat-logo-light.png" alt="" aria-hidden className="h-[7.5cqw] w-auto" />

            {preview ? (
              <span className="font-mono text-[2.1cqw] uppercase tracking-[0.24em] text-[hsl(30_70%_82%)]">
                {isAr ? "معاينة" : "Preview"}
              </span>
            ) : (
              !hideStatus && <StatusPill active={!!membershipActive} comingSoon={comingSoon} isAr={isAr} />
            )}
          </div>

          {/* Identity: portrait + the name, large — the cat is the hero (R009). */}
          <div className={cn("flex min-h-0 items-center gap-[3.4cqw]", !detailed && "flex-1")}>
            <span
              className={cn(
                "relative shrink-0 overflow-hidden rounded-[3cqw] bg-white/10 p-[0.6cqw] ring-1 ring-white/30",
                detailed ? "size-[12cqw]" : "size-[16cqw]"
              )}
            >
              <ImgWithFallback
                src={photoUrl}
                alt=""
                className="size-full rounded-[2.5cqw] object-cover"
                fallback={
                  <span aria-hidden className="grid size-full place-items-center rounded-[2.5cqw] bg-[hsl(170_60%_9%)]">
                    <IlloPaw tone="butter" className="size-[6.5cqw] opacity-60" />
                  </span>
                }
              />
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate font-display font-semibold leading-[1.08] tracking-tight",
                  detailed ? "text-[5.2cqw]" : "text-[7.2cqw]"
                )}
              >
                {dispName}
              </p>
              {/* A quiet signature — the owner's accent, one hairline, no more (R080). */}
              {accentHsl && (
                <span
                  aria-hidden
                  className="mt-[1.4cqw] block h-[0.7cqw] w-[10cqw] rounded-full"
                  style={{ backgroundColor: `hsl(${accentHsl})` }}
                />
              )}
              {detailed && meta && (
                <p className="mt-[1cqw] truncate text-[2.6cqw] leading-snug text-white/75">{meta}</p>
              )}
              {/* Founding standing outranks tenure in the one line there is room
                  for: "I was here first" is the prouder, rarer fact, and it
                  carries its own proof (the ordinal) right beside it. Everyone
                  else keeps the tenure line unchanged. */}
              {!detailed && founding ? (
                <p className="mt-[1.2cqw] font-mono text-[2.2cqw] uppercase tracking-[0.16em] text-[hsl(30_80%_78%)]">
                  {/* Only the DIGITS are isolated, never the Arabic label. An
                      earlier version wrapped "رقم 57" in dir="ltr" and bidi
                      reordering collapsed it to "عضو مؤسِّسرقم · 57". The label
                      is RTL text and must stay in the paragraph's own flow;
                      <bdi> isolates just the numeral (R101/R104). */}
                  {isAr ? "عضو مؤسِّس · رقم " : "Founding Member · #"}
                  <bdi dir="ltr">{catNumber}</bdi>
                </p>
              ) : (
                !detailed && since && (
                  <p className="mt-[1.2cqw] font-mono text-[2.2cqw] uppercase tracking-[0.16em] text-white/55">
                    {isAr ? `عضو منذ ${since}` : `Member since ${since}`}
                  </p>
                )
              )}
            </div>
          </div>

          {/* The record: who to call, what's protected — the card's real jobs (§05). */}
          {detailed && (
            <dl className="grid grid-cols-2 gap-x-[3.5cqw] gap-y-[1.4cqw]">
              <Detail label={isAr ? "المالك" : "Owner"} value={dispOwner} isAr={isAr} />
              <Detail label={isAr ? "للطوارئ" : "Emergency"} value={ownerPhone} isAr={isAr} mono />
              <Detail label={isAr ? "التطعيمات" : "Vaccines"} value={vaccinationLabel(vaccinationStatus, isAr)} isAr={isAr} />
              <Detail label={isAr ? "طعامه المفضّل" : "Favourite food"} value={favoriteFood} isAr={isAr} />
            </dl>
          )}
        </div>

        {/* ── The paper band — warm ground, human-readable number, scannable QR ── */}
        <div className="flex h-[19cqw] shrink-0 items-center justify-between gap-[3cqw] border-t border-dashed border-[hsl(168_35%_25%/0.3)] bg-[hsl(40_45%_96%)] px-[5.5cqw] text-[hsl(168_60%_10%)]">
          <div className="min-w-0 leading-none">
            <p className="truncate font-mono text-[1.9cqw] uppercase tracking-[0.26em] text-[hsl(168_30%_34%)]">
              {isAr ? "رقم الهوية" : "Cat ID"}
              {/* Tenure shows under the name in simple mode — only the detailed
                  card (no room up top) carries it here. Never both. Founding
                  standing takes the slot when it applies, same precedence as
                  the simple card, so the two modes never disagree. */}
              {detailed && founding
                ? (isAr ? ` · عضو مؤسِّس ${ordinal}` : ` · Founding Member ${ordinal}`)
                : detailed && since
                  ? (isAr ? ` · عضو منذ ${since}` : ` · Member since ${since}`)
                  : ""}
            </p>
            <p className="mt-[1.6cqw] font-mono text-[4.4cqw] font-medium tracking-[0.16em] text-[hsl(170_82%_12%)] tabular" dir="ltr">
              {catIdNumber}
            </p>
          </div>

          {!preview && qrValue ? (
            <QrTile value={qrValue} isAr={isAr} />
          ) : (
            <span className="inline-flex shrink-0 items-center gap-[1.2cqw] font-mono text-[2cqw] uppercase tracking-[0.22em] text-[hsl(168_30%_34%)]">
              <ShieldCheck className="size-[3.2cqw]" />
              {isAr ? "هوية رسمية" : "Official ID"}
            </span>
          )}
        </div>

        {/* ── The keepsake layer — owner frame + placed stickers, over everything
              but never interactive; positions are LTR fractions so they read
              identically in AR/RTL and in the exported PNG. ── */}
        {(frameFx.boxShadow || frameFx.corners || (stickers && stickers.length > 0)) && (
          <span aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-[5cqw]" style={{ boxShadow: frameFx.boxShadow }}>
            {frameFx.corners?.map((g, i) => (
              <span key={`corner-${i}`} className="absolute text-[5cqw] leading-none" style={CORNER_POS[i]}>{g}</span>
            ))}
            {stickers?.map((s, i) => (
              <span
                key={`sticker-${i}`}
                className="absolute select-none leading-none drop-shadow-[0_1cqw_1.5cqw_rgba(0,0,0,0.28)]"
                style={{
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  fontSize: `${8 * s.scale}cqw`,
                  transform: `translate(-50%,-50%) rotate(${s.rotate}deg) scaleX(${s.flip ? -1 : 1})`,
                }}
              >
                {s.glyph}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/** Four-corner slots for framed motifs, kept clear of the paper band (~19cqw). */
const CORNER_POS: CSSProperties[] = [
  { top: "2.5cqw", left: "2.5cqw" },
  { top: "2.5cqw", right: "2.5cqw" },
  { bottom: "21cqw", left: "2.5cqw" },
  { bottom: "21cqw", right: "2.5cqw" },
];

/** White QR tile on the paper band — maximum contrast, honest quiet zone. */
function QrTile({ value, isAr }: { value: string; isAr: boolean }) {
  return (
    <div className="shrink-0 rounded-[2cqw] bg-white p-[1.3cqw] shadow-[0_1px_2px_hsl(168_40%_20%/0.14)] ring-1 ring-[hsl(168_20%_78%)]">
      <QRCodeSVG
        value={value}
        size={256}
        level="M"
        bgColor="#ffffff"
        fgColor="#0b3b30"
        style={{ width: "11.5cqw", height: "11.5cqw" }}
      />
      <p className="mt-[0.6cqw] text-center font-mono text-[1.5cqw] uppercase tracking-[0.18em] text-[hsl(168_30%_36%)]">
        {isAr ? "تحقّق" : "Verify"}
      </p>
    </div>
  );
}

function StatusPill({ active, comingSoon, isAr }: { active: boolean; comingSoon: boolean; isAr: boolean }) {
  // Before paid membership exists, the card is still a real, issued credential —
  // present it as a verified official identity, never a "coming soon" placeholder.
  if (comingSoon) {
    return (
      <span className="inline-flex shrink-0 items-center gap-[1.3cqw] rounded-full bg-[hsl(150_60%_45%/0.15)] px-[2.2cqw] py-[0.9cqw] text-[2cqw] font-semibold uppercase tracking-[0.16em] text-[hsl(150_55%_82%)] ring-1 ring-[hsl(150_55%_60%/0.32)]">
        <ShieldCheck className="size-[2.6cqw]" />
        {isAr ? "موثّقة" : "Verified"}
      </span>
    );
  }
  // Commerce era: leaf-green when the membership is active; lapsed keeps full
  // legibility (≥4.5:1 on the deep-green field, R091) with an amber dot so the
  // state never rides on colour alone next to the "Inactive" label (R093/R006).
  const tone = active
    ? "bg-[hsl(150_60%_45%/0.16)] text-[hsl(150_60%_82%)] ring-[hsl(150_60%_60%/0.35)]"
    : "bg-white/10 text-white/90 ring-white/20";
  const dot = active ? "bg-[hsl(150_60%_60%)]" : "bg-amber-300";
  const label = active ? (isAr ? "فعّالة" : "Active") : isAr ? "غير مفعّلة" : "Inactive";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-[1.3cqw] rounded-full px-[2.2cqw] py-[0.9cqw] text-[2cqw] font-semibold uppercase tracking-[0.16em] ring-1", tone)}>
      <span className={cn("size-[1.4cqw] rounded-full", dot)} />
      {label}
    </span>
  );
}

function Detail({ label, value, isAr, mono }: { label: string; value?: string | null; isAr: boolean; mono?: boolean }) {
  return (
    <div className="min-w-0 leading-none">
      <dt className="font-mono text-[1.9cqw] uppercase tracking-[0.2em] text-[hsl(40_45%_85%)]/70">{label}</dt>
      <dd
        className={cn("mt-[1cqw] truncate text-[2.9cqw] leading-snug text-white/90", mono && "font-mono tracking-[0.06em] tabular")}
        dir={mono ? "ltr" : undefined}
        style={mono ? { textAlign: isAr ? "right" : "left" } : undefined}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function genderLabel(gender: string | null | undefined, isAr: boolean): string | null {
  if (gender === "MALE") return isAr ? "ذكر" : "Male";
  if (gender === "FEMALE") return isAr ? "أنثى" : "Female";
  return null;
}

function vaccinationLabel(status: string | null | undefined, isAr: boolean): string | null {
  switch (status) {
    case "UP_TO_DATE": return isAr ? "مكتملة" : "Up to date";
    case "PARTIAL": return isAr ? "جزئية" : "Partial";
    case "NONE": return isAr ? "لا يوجد" : "None";
    default: return isAr ? "غير مسجّلة" : "Not recorded"; // honest, never invented (R040)
  }
}

/** Rounded age from a birth date, in natural Arabic/English ("سنتين", "4 أشهر"). */
function ageLabel(birthDate: string, isAr: boolean): string | null {
  const b = new Date(birthDate);
  if (Number.isNaN(+b)) return null;
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 12) {
    if (!isAr) return `${months} mo`;
    if (months <= 1) return "شهر";
    if (months === 2) return "شهرين";
    return months <= 10 ? `${months} أشهر` : `${months} شهر`;
  }
  const years = Math.floor(months / 12);
  if (!isAr) return years === 1 ? "1 yr" : `${years} yrs`;
  if (years === 1) return "سنة";
  if (years === 2) return "سنتين";
  return years <= 10 ? `${years} سنوات` : `${years} سنة`;
}
