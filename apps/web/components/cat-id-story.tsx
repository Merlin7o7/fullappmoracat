"use client";

import { CatIdCard } from "@/components/cat-id-card";
import { formatDate } from "@moraqat/core";

/**
 * "Share my Moracat ID" — the 9:16 Story frame (540×960 CSS px, captured at
 * pixelRatio 2 → 1080×1920). AD 2.1 «السجل»: a page from the cat's archive.
 *
 *   · an emerald ID band names the document (kind · serial), like every other
 *     artifact Moracat issues — so a Story reads as "Moracat" at a glance;
 *   · the card is the hero, tilted on warm paper, with the founder's plush cat
 *     render peeking over it and the plush heart tucked below (3D rule for
 *     share artifacts: at most two, never touching the card's data);
 *   · the copper seal + issue date under the card is the proof line;
 *   · one emerald invitation at the bottom.
 *
 * Copy never says "official" (AD 2.1 framing). Everything sits inside the
 * Story safe area (~110px top / ~130px bottom at this scale). Light tokens are
 * pinned inline so the frame renders identically in either theme, and 3D
 * renders are plain same-origin <img>s so html-to-image can embed them.
 */

const LIGHT_TOKENS: Record<string, string> = {
  "--primary": "166 91% 19%",
  "--accent": "18 93% 58%",
  "--blush": "359 100% 86%",
  "--sage": "196 20% 58%",
  "--butter": "44 88% 86%",
  "--peach": "26 100% 89%",
  "--cream": "30 68% 90%",
  "--leaf": "145 45% 34%",
};

const EMERALD = "hsl(166 91% 19%)";
const COPPER = "#B5532A";
const INK = "hsl(165 45% 8%)";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export interface CatIdStoryProps {
  catName: string;
  catIdNumber: string;
  issuedAt?: string | null;
  photoUrl?: string | null;
  qrToken?: string | null;
  membershipActive?: boolean;
  isAr: boolean;
}

/** The copper seal, drawn inline (same mark as `Seal` in @moraqat/ui). */
function SealMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COPPER} strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="10.5" strokeOpacity="0.45" />
      <circle cx="12" cy="12" r="8" strokeDasharray="1.5 2" />
      <path d="M8.5 12.2l2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CatIdStory({ catName, catIdNumber, issuedAt, photoUrl, qrToken, membershipActive, isAr }: CatIdStoryProps) {
  const loc = isAr ? "ar" : "en";
  const issued = issuedAt ? formatDate(issuedAt, loc, "medium") : null;
  return (
    // The CAPTURED root must stay dir="ltr": WebKit's foreignObject renderer
    // mis-anchors RTL roots horizontally (blank band on iPhone exports). Text
    // direction is applied on the inner layer instead.
    <div
      dir="ltr"
      style={{ width: 540, height: 960, ...LIGHT_TOKENS, color: INK } as React.CSSProperties}
      className="relative isolate overflow-hidden bg-[#FAF7F2]"
    >
      {/* Paper: one soft emerald pool behind the card, plus grain (no blend
          modes — Safari's foreignObject compositor blacks them out). */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: "radial-gradient(60% 38% at 50% 50%, hsl(166 60% 40% / 0.10), transparent 70%)" }}
      />
      <div aria-hidden className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px" }} />

      <div dir={isAr ? "rtl" : "ltr"} className="absolute inset-0 flex flex-col items-center">
        {/* ── The ID band: what this is, and its serial ── */}
        <div
          className="mt-[96px] flex w-[452px] items-center justify-between rounded-[10px] px-5 py-3 text-white"
          style={{ background: EMERALD }}
        >
          <span className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/moracat-logo-light.png" alt="" aria-hidden className="h-7 w-auto" />
            <span className="text-[17px] font-semibold">{isAr ? "هوية مرقط" : "Moracat ID"}</span>
          </span>
          <span dir="ltr" className="font-mono text-[14px] tracking-[0.12em] opacity-85">
            {catIdNumber}
          </span>
        </div>

        {/* ── The headline: the cat's name carries it ── */}
        <h1
          className={
            isAr
              ? "font-arabic-display mt-9 max-w-[452px] text-center text-[46px] font-normal leading-[1.25]"
              : "font-display mt-9 max-w-[452px] text-center text-[44px] font-semibold leading-[1.1] tracking-[-0.02em]"
          }
        >
          {isAr ? (
            <>
              {catName}
              <span className="block text-[30px] text-[hsl(165_14%_34%)]">صار له هوية تخصّه</span>
            </>
          ) : (
            <>
              {catName}
              <span className="block text-[26px] font-normal text-[hsl(165_14%_34%)]">has an ID of their own</span>
            </>
          )}
        </h1>

        {/* ── The hero: the card, with the plush cat peeking over it ── */}
        <div className="relative mt-[116px] w-[420px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/3d/cat-plush.webp"
            alt=""
            aria-hidden
            className="absolute -top-[104px] end-[18px] z-0 h-[150px] w-[150px] object-contain"
            style={{ filter: "drop-shadow(0 10px 14px hsl(165 40% 14% / 0.22))" }}
          />
          <div className="relative z-10 rotate-[-2.5deg] rounded-2xl shadow-[0_28px_56px_-14px_hsl(165_40%_14%/0.38)]">
            <CatIdCard
              exportMode
              catName={catName}
              catIdNumber={catIdNumber}
              issuedAt={issuedAt}
              photoUrl={photoUrl}
              qrToken={qrToken}
              membershipActive={membershipActive}
              isAr={isAr}
              className="max-w-none"
            />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/3d/heart-plush.webp"
            alt=""
            aria-hidden
            className="absolute -bottom-[78px] start-[-44px] z-20 h-[96px] w-[96px] rotate-[-10deg] object-contain"
            style={{ filter: "drop-shadow(0 8px 10px hsl(165 40% 14% / 0.2))" }}
          />
        </div>

        {/* ── The proof line: the seal and the day it was issued ── */}
        <div className="mt-[50px] flex items-center gap-2.5 text-[16px] text-[hsl(165_14%_30%)]">
          <SealMark />
          <span>
            {issued
              ? isAr ? `سُجّل في سجل مرقط · ${issued}` : `Entered in the Moracat register · ${issued}`
              : isAr ? "مسجّل في سجل مرقط" : "Entered in the Moracat register"}
          </span>
        </div>

        {/* ── The invitation ── */}
        <div className="mt-auto flex flex-col items-center pb-[124px]">
          <p className="text-[17px] text-[hsl(165_12%_32%)]">
            {isAr ? "لِحياة قطّك كلّها" : "For your cat's whole life"}
          </p>
          <span
            className="mt-4 inline-flex items-center gap-2 rounded-[10px] px-7 py-3.5 text-[17px] font-semibold text-white"
            style={{ background: EMERALD }}
          >
            {isAr ? "سوّ هوية قطك" : "Create your cat's ID"}
            <span aria-hidden className="opacity-60">·</span>
            <span dir="ltr" className="font-normal opacity-80">moracat.co</span>
          </span>
        </div>
      </div>
    </div>
  );
}
