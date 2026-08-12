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
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-e3 sm:flex-row sm:items-center">
        <Cookie className="size-5 shrink-0 text-primary" />
        <p className="flex-1 text-sm text-muted-foreground">
          {isAr
            ? "نستخدم تخزيناً محلياً أساسياً فقط لتشغيل الموقع — بلا إعلانات تتبّع. "
            : "We use only essential local storage to run the site — no ad trackers. "}
          <Link href="/legal/cookies" className="font-medium text-primary hover:underline">
            {isAr ? "اعرف أكثر" : "Learn more"}
          </Link>
        </p>
        <Button size="sm" onClick={accept} className="shrink-0">
          {isAr ? "تمام" : "Got it"}
        </Button>
      </div>
    </div>
  );
}
