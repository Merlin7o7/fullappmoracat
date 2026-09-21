"use client";

import * as React from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";

const KEY = "moraqat.cookieConsent";
/** Fired on accept so other fixed-bottom UI (the mobile register bar) can
 *  wait its turn instead of stacking on the banner. */
export const COOKIE_CONSENT_EVENT = "moraqat:cookie-consent";

/** True once the visitor has dismissed the notice (safe on the server). */
export function hasCookieConsent(): boolean {
  try {
    return typeof window !== "undefined" && !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

/** Minimal, honest cookie notice — we only use essential storage (see policy). */
export function CookieConsent() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (!localStorage.getItem(KEY)) setShow(true);
  }, []);

  if (!show) return null;

  function accept() {
    localStorage.setItem(KEY, "1");
    setShow(false);
    window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4" role="dialog" aria-label={isAr ? "إشعار ملفات الارتباط" : "Cookie notice"}>
      {/* One compact row at every width: on a phone a stacked card took a fifth
          of the first screen — and hid the page's one action behind a notice. */}
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-e3 sm:p-4">
        <Cookie className="hidden size-5 shrink-0 text-primary sm:block" />
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {isAr
            ? "نستخدم تخزيناً محلياً لتشغيل الموقع ولقياس استخدامه بشكل مجهول — بلا إعلانات ولا تتبّع خارج مرقط. "
            : "We use local storage to run the site and to measure its use anonymously — no ads, no tracking beyond Moracat. "}
          <Link href="/legal/cookies" className="font-medium text-primary hover:underline">
            {isAr ? "اعرف أكثر" : "Learn more"}
          </Link>
        </p>
        <Button size="sm" onClick={accept} className="min-h-11 shrink-0">
          {isAr ? "تمام" : "Got it"}
        </Button>
      </div>
    </div>
  );
}
