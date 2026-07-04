"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@moraqat/ui";
import { IlloMouse } from "@/components/illustrations";

/**
 * Every error is a recovery (R112) — warm, blameless copy (R084/R113),
 * one clear action to retry. Bilingual inline: the error boundary may render
 * outside the locale provider.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mesh-bg grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <IlloMouse tone="sage" className="h-14 w-auto animate-bob" />
        <h1 className="mt-7 font-display text-2xl font-semibold tracking-tight" lang="ar" dir="rtl">
          حدث خطأ ما — ليس منك
        </h1>
        <p className="mt-1.5 font-display text-lg font-medium text-foreground/80" lang="en" dir="ltr">
          Something went wrong — not your fault
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground" lang="ar" dir="rtl">
          حاول مرة أخرى، وإذا تكرر الأمر فالدعم على بُعد نقرة.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground" lang="en" dir="ltr">
          Try again — and if it keeps happening, support is one tap away.
        </p>
        <Button size="lg" className="mt-8" onClick={reset}>
          <RotateCcw className="size-4" /> حاول مجدداً · Try again
        </Button>
      </div>
    </div>
  );
}
