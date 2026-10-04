"use client";

import * as React from "react";
import { Globe, Lock } from "lucide-react";
import { cn } from "@moraqat/ui";

/**
 * The two decisions sign-up asks for, at the moment they apply (2026-08-14
 * amendment guardrail #1; R106). Neither blocks the Cat ID.
 */

/**
 * Unticked, optional. A pre-ticked box isn't consent, and the welcome page's
 * «نخبرك أول ما نفتح» is only true for people who said yes here.
 */
export function WaitlistConsentLine({ isAr, checked, onChange }: { isAr: boolean; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-1 py-2 text-sm leading-relaxed focus-within:ring-2 focus-within:ring-ring">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-none"
      />
      <span>
        {isAr ? "أبغى أعرف أول ما تفتح خطط العناية" : "Tell me when care plans open"}
        <span className="block text-xs text-muted-foreground">
          {isAr ? "رسالة وحدة على بريدك — وتقدر توقفها متى ما تبي." : "One email when they do — stop it any time."}
        </span>
      </span>
    </label>
  );
}

/**
 * Community visibility is opt-out: the cat is public by default — the cat,
 * never the person — and only appears once it has a photo. The default is
 * stated with its off switch right beside it.
 */
export function CommunityDisclosure({
  isAr,
  catName,
  isPublic,
  onChange,
}: {
  isAr: boolean;
  catName: string;
  isPublic: boolean;
  onChange: (v: boolean) => void;
}) {
  const name = catName.trim() || (isAr ? "قطك" : "Your cat");
  return (
    <div className="rounded-xl border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm leading-relaxed">
          {isPublic
            ? isAr
              ? `${name} بيظهر في مجتمع مرقط بدون اسمك`
              : `${name} will appear in the Moracat community, without your name`
            : isAr
              ? `${name} بيبقى خاص — ما يظهر في المجتمع`
              : `${name} stays private — not shown in the community`}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={!isPublic}
          aria-label={isAr ? `خلّ ${name} خاص` : `Keep ${name} private`}
          onClick={() => onChange(!isPublic)}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isPublic ? "bg-card text-foreground ring-border hover:bg-muted" : "bg-primary/10 text-primary ring-primary/30"
          )}
        >
          {isPublic ? <Lock className="size-3.5" aria-hidden /> : <Globe className="size-3.5" aria-hidden />}
          {isPublic ? (isAr ? "خلّه خاص" : "Keep private") : (isAr ? "خلّه يظهر" : "Show them")}
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {isAr
          ? "قطك يظهر في مجتمع مرقط من أول يوم — بدون اسمك ومدينتك — إذا عنده صورة. تقدر تخفيه بضغطة من ملفه."
          : "Your cat appears in the Moracat community from day one — without your name or city — if they have a photo. Hide them with one tap from their file."}
      </p>
    </div>
  );
}

/** PDPL people-in-photo attestation (R106): the act of uploading is the attestation. */
export function PhotoAttestation({ isAr, className }: { isAr: boolean; className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      {isAr
        ? "برفعك الصورة تؤكد أن أي شخص يظهر فيها موافق على نشرها."
        : "By uploading, you confirm anyone visible in the photo agreed to share it."}
    </p>
  );
}
