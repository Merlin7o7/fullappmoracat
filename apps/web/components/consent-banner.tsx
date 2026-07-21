"use client";

/**
 * Analytics consent banner for the Cat Census (PDPL opt-in, R106).
 *
 * Design Authority discipline applied here:
 *  - Honest by default (R006 / P06): Accept and Decline are the *same* weight and
 *    the *same* effort — no pre-tick, no greyed-out "no", no nagging. Declining is a
 *    first-class choice, and the standing default until someone actively accepts.
 *  - Calm over clever (R007): one quiet line, one link, two buttons. No urgency.
 *  - Trust precedes the ask (R004): plain language about exactly what we collect and why.
 *  - Bilingual, Arabic-first RTL-native (R101) via `useLocale`; logical `start/end`
 *    props so it mirrors correctly (R104). ≥44px targets (R092), visible focus (R097),
 *    reduced-motion honoured (R075).
 *
 * This is distinct from the essential-storage cookie notice (`cookie-consent.tsx`):
 * that one explains storage we can't run the site without; this one asks permission
 * for optional third-party analytics, which is the part PDPL requires be opt-in.
 */

import * as React from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { getConsentState, grantConsent, denyConsent } from "@/lib/analytics";

const COPY = {
  ar: {
    label: "إذن تحليلات التعداد",
    body: "نستخدم أدوات تحليلية بسيطة نفهم فيها كيف يكبر التعداد — بدون بيانات تعرّفك. الخيار لك.",
    privacy: "سياسة الخصوصية",
    accept: "أوافق",
    decline: "لا، شكراً",
  },
  en: {
    label: "Census analytics consent",
    body: "We use light analytics to understand how the census grows — never anything that identifies you. Your choice.",
    privacy: "Privacy policy",
    accept: "I agree",
    decline: "No thanks",
  },
} as const;

export function ConsentBanner() {
  const { locale } = useLocale();
  const t = COPY[locale] ?? COPY.ar;

  // Render nothing until we've read the persisted choice on the client, so there's no
  // SSR/first-paint flash and the banner never appears once a choice exists (R117 —
  // a decision, once made, is remembered and respected).
  const [undecided, setUndecided] = React.useState(false);

  React.useEffect(() => {
    setUndecided(getConsentState() === null);
  }, []);

  const accept = React.useCallback(() => {
    grantConsent();
    setUndecided(false);
  }, []);

  const decline = React.useCallback(() => {
    denyConsent();
    setUndecided(false);
  }, []);

  if (!undecided) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.label}
      // Fixed bottom, thumb-zone (R100); pb-safe clears the iOS home indicator.
      // motion-safe: gates the entrance so reduced-motion users get no transform (R075);
      // animate-slide-in-up is the design system's own bottom-entrance keyframe.
      className="fixed inset-x-0 bottom-0 z-40 p-3 pb-safe sm:p-4 motion-safe:animate-slide-in-up"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-[1.5rem] border border-border bg-card p-4 shadow-e2 sm:flex-row sm:items-center sm:gap-4">
        <BarChart3 className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
          {t.body}{" "}
          <Link
            href="/legal/privacy"
            className="rounded font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t.privacy}
          </Link>
        </p>
        {/* Two equal-weight actions. Decline is deliberately as easy as Accept (R006). */}
        <div className="flex shrink-0 gap-2">
          {/* size="md" = 44px, meeting the touch-target floor (R092). Both buttons are
              the same size and prominence — decline is genuinely as easy as accept. */}
          <Button variant="outline" size="md" onClick={decline} className="flex-1 sm:flex-none">
            {t.decline}
          </Button>
          <Button variant="primary" size="md" onClick={accept} className="flex-1 sm:flex-none">
            {t.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
