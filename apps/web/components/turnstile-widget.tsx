"use client";

import * as React from "react";
import Script from "next/script";
import { setTurnstileToken, turnstileEnabled, turnstileSiteKey } from "@/lib/turnstile";
import { useLocale } from "@/app/providers";

/**
 * Cloudflare Turnstile challenge — proof-of-humanity on the census front door.
 *
 * Renders nothing when Turnstile isn't configured (no site key), so the
 * registration and cat-creation forms are unchanged in dev/CI and any
 * environment that hasn't turned it on. When configured, it mounts the widget,
 * hands each solved token to the shared store, and clears it on expiry so a
 * stale token is never sent.
 *
 * Privacy-first (R106): Turnstile is a no-cookie, no-PII challenge — the
 * privacy-preserving choice among bot defences, which is why it's used instead
 * of an ad-network CAPTCHA.
 */
export function TurnstileWidget({ className }: { className?: string }) {
  const { locale } = useLocale();
  const ref = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | null>(null);

  const render = React.useCallback(() => {
    const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!ts || !ref.current || widgetId.current) return;
    widgetId.current = ts.render(ref.current, {
      sitekey: turnstileSiteKey(),
      language: locale === "ar" ? "ar" : "en",
      callback: (token: string) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(null),
      "error-callback": () => setTurnstileToken(null),
    });
  }, [locale]);

  React.useEffect(() => {
    if (!turnstileEnabled()) return;
    render();
    return () => {
      const ts = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (ts && widgetId.current) {
        ts.remove(widgetId.current);
        widgetId.current = null;
      }
      setTurnstileToken(null);
    };
  }, [render]);

  if (!turnstileEnabled()) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={render}
      />
      {/* Left-aligned with the form; the widget owns its own sizing. */}
      <div ref={ref} className={className} />
    </>
  );
}

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      language?: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  remove: (id: string) => void;
}
