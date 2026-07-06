"use client";

import { CatIdCard } from "@/components/cat-id-card";
import { IlloCat, IlloFish, IlloHeart, IlloMouse, IlloPaw, IlloSprig } from "@/components/illustrations";

/**
 * "Share my Moracat ID" — a 9:16 Instagram-Story canvas with the Cat ID as the
 * hero (R009), composed like a campaign frame: warm-paper ground, film grain,
 * sticker sheet, marker-underlined headline, and a green CTA chip that invites
 * the viewer to make their own. Designed at 540×960 CSS px and captured at
 * pixelRatio 2 → exactly 1080×1920. All copy + card stay inside the Story safe
 * area (~110px top / ~130px bottom margins at this scale).
 *
 * Light-theme brand tokens are pinned inline so the frame renders identically
 * whatever theme the member browses in.
 */

// The illustration set resolves its tones from CSS vars — pin the light values.
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

export function CatIdStory({ catName, catIdNumber, issuedAt, photoUrl, qrToken, membershipActive, isAr }: CatIdStoryProps) {
  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      style={{ width: 540, height: 960, ...LIGHT_TOKENS } as React.CSSProperties}
      className="relative isolate flex flex-col items-center overflow-hidden bg-[#faf7f1] text-[hsl(165_45%_8%)]"
    >
      {/* Ambient tints + grain — the paper the stickers live on. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(70% 45% at 50% 12%, hsl(166 91% 19% / 0.07), transparent 65%), radial-gradient(55% 40% at 50% 88%, hsl(18 93% 58% / 0.08), transparent 60%)",
        }}
      />
      {/* Plain low-opacity grain — NO mix-blend-mode: Safari's foreignObject
          compositor mishandles blend modes and blacks out whole regions of the
          captured image on iPhone. Visually near-identical at this opacity. */}
      <div aria-hidden className="absolute inset-0 -z-10 opacity-[0.04]" style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px" }} />

      {/* ── Header: the brand, then the announcement ── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/moracat-logo.png" alt="" aria-hidden className="mt-[104px] h-16 w-auto" />

      <p className="mt-9 whitespace-nowrap font-mono text-[13px] font-semibold uppercase tracking-[0.3em] text-[hsl(18_93%_44%)]">
        {isAr ? "✦ هوية رسمية ✦" : "✦ Officially ID'd ✦"}
      </p>

      <h1 className="mt-3 max-w-[430px] text-center font-display text-[38px] font-bold leading-[1.2] tracking-tight">
        {isAr ? (
          <>
            <span className="underline-marker">رسمياً</span> — {catName} من عائلة مرقط 🐾
          </>
        ) : (
          <>
            {catName} is <span className="underline-marker">officially</span> a Moracat 🐾
          </>
        )}
      </h1>

      {/* ── The hero: the card on its sticker sheet ── */}
      <div className="relative mt-12 w-[400px]">
        <IlloMouse tone="sage" className="absolute -start-12 -top-9 h-11 w-auto rotate-[-14deg] rtl:-scale-x-100" />
        <IlloHeart tone="pink" className="absolute -end-9 -top-11 size-10 rotate-[10deg]" />
        <IlloFish tone="orange" className="absolute -end-12 top-1/2 h-8 w-auto rotate-[18deg]" />
        <IlloSprig tone="leaf" className="absolute -bottom-12 -start-9 h-16 w-auto rotate-[-16deg] opacity-80" />
        <IlloPaw tone="butter" className="absolute -bottom-10 -end-7 size-12 rotate-[16deg]" />

        <div className="rotate-[-3deg] rounded-[1.2rem] shadow-[0_24px_48px_-12px_hsl(165_40%_14%/0.35)]">
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
      </div>

      {/* ── Footer: the promise + the invitation ── */}
      <div className="mt-auto flex flex-col items-center pb-[128px]">
        <IlloCat tone="green" className="h-14 w-auto" />
        <p className="mt-4 text-[17px] font-medium text-[hsl(165_12%_32%)]">
          {isAr ? "كل قط يستاهل هوية تخصّه وحده" : "Every great cat deserves an identity of their own"}
        </p>
        <span className="mt-5 inline-flex items-center gap-2.5 rounded-full bg-[hsl(166_91%_19%)] px-7 py-3.5 text-[16px] font-bold text-[hsl(40_60%_96%)]">
          <IlloPaw tone="orange" className="size-5" />
          {isAr ? "سوّ هوية قطك · moracat.co" : "Create your cat's ID · moracat.co"}
        </span>
      </div>
    </div>
  );
}
