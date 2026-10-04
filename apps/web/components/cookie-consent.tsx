"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomBar, BOTTOM_LAYER, Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { CONSENT_OPEN_EVENT, readConsent, writeConsent } from "@/lib/track";

/**
 * The measurement notice — one honest sentence and a real choice (audit
 * MRC-UX-AUDIT-2026-10-04 Problem 4/7, Part 07 M2).
 *
 *  · «موافق» turns on Moracat's own first-party measurement; «بدون قياس»
 *    keeps it off, and lib/track.ts then sends nothing at all. Nothing is
 *    sent before a choice either.
 *  · It is a slim strip on the bottom stack's top layer: it sits ABOVE the
 *    portal tab bar and any sticky CTA, never on top of them.
 *  · Never on /c/* — a finder holding a stranger's cat needs the one button,
 *    not a notice (audit Part 06, Lost & Found).
 *  · The footer's «إعدادات القياس» reopens it to change the choice.
 */
export function CookieConsent() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const pathname = usePathname() ?? "";
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (!readConsent()) setShow(true);
    const reopen = () => setShow(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
  }, []);

  if (!show || pathname.startsWith("/c/")) return null;

  const choose = (choice: "granted" | "denied") => {
    writeConsent(choice);
    setShow(false);
  };

  return (
    <BottomBar
      layer={BOTTOM_LAYER.notice}
      role="region"
      aria-label={isAr ? "إشعار القياس" : "Measurement notice"}
      className="z-[45] border-t border-border bg-card/95 shadow-e3 backdrop-blur sm:pointer-events-none sm:border-0 sm:bg-transparent sm:px-4 sm:pb-4 sm:shadow-none sm:backdrop-blur-none"
    >
      <div className="flex flex-col gap-2 px-4 pt-3 pb-bar sm:pointer-events-auto sm:border-border sm:bg-card sm:shadow-e3 sm:mx-auto sm:max-w-3xl sm:flex-row sm:items-center sm:gap-4 sm:rounded-2xl sm:border sm:p-4">
        <p className="text-xs leading-relaxed text-muted-foreground sm:flex-1 sm:text-sm">
          {isAr
            ? "نقيس استخدام الموقع بأنفسنا لنحسّنه، ولا نشاركه مع أي جهة إعلانية. "
            : "We measure how the site is used, ourselves, to improve it — and never share it with any advertiser. "}
          <Link href="/legal/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
            {isAr ? "سياسة الخصوصية" : "Privacy policy"}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="secondary" className="flex-1 sm:flex-none" onClick={() => choose("denied")}>
            {isAr ? "بدون قياس" : "No measurement"}
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => choose("granted")}>
            {isAr ? "موافق" : "Allow"}
          </Button>
        </div>
      </div>
    </BottomBar>
  );
}
