"use client";

import * as React from "react";
import { Button } from "@moraqat/ui";
import { CatIdCard } from "./cat-id-card";

interface CeremonyCat {
  name: string;
  catIdNumber: string;
  idIssuedAt?: string | null;
  photoUrl?: string | null;
}

/**
 * The Cat ID reveal — a moment, not a transaction (Dossier §05, R031).
 * The richest animation in the product lives here on purpose (R073); everything
 * else stays calm so this peak means something. Reduced-motion collapses it to a
 * gentle fade (R075 via the global media-query kill-switch).
 */
export function CatIdCeremony({ cat, isAr, onClose }: { cat: CeremonyCat; isAr: boolean; onClose: () => void }) {
  const titleId = React.useId();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 animate-fade-in bg-[hsl(168_50%_5%/0.88)] backdrop-blur-md" aria-hidden />

      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <p className="animate-fade-up font-mono text-[10px] uppercase tracking-[0.28em] text-[hsl(18_93%_62%)]">
          {isAr ? "صارت رسمية" : "It's official"}
        </p>
        <h2 id={titleId} className="mt-3 animate-fade-up animate-delay-150 font-display text-3xl font-semibold tracking-tight text-white">
          {isAr ? `${cat.name} صار عضو` : `${cat.name} is a member`}
        </h2>
        <p className="mt-2 animate-fade-up animate-delay-300 text-sm leading-relaxed text-white/65">
          {isAr
            ? "هوية على اسمه، ورقم يخصّه هو بس."
            : "An identity in their name, and a number that's theirs alone."}
        </p>

        {/* The artifact arrives last — the eye lands here and stays. */}
        <div className="mt-8 w-full animate-scale-in [animation-delay:450ms] [animation-duration:600ms]">
          <CatIdCard
            catName={cat.name}
            catIdNumber={cat.catIdNumber}
            issuedAt={cat.idIssuedAt}
            photoUrl={cat.photoUrl}
            isAr={isAr}
            className="mx-auto shadow-glow"
          />
        </div>

        <div className="mt-9 w-full animate-fade-up [animation-delay:800ms]">
          <Button size="lg" className="w-full" onClick={onClose}>
            {isAr ? `يلا نبدأ مع ${cat.name}` : `Begin ${cat.name}'s journey`}
          </Button>
        </div>
      </div>
    </div>
  );
}
