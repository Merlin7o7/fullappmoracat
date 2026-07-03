"use client";

import * as React from "react";
import { useToast } from "@moraqat/ui";

/**
 * "Continue with Google". When a client ID is configured we render Google's
 * official Identity Services button and hand the credential to the API; without
 * one we stay honest (R006) and tell the user it isn't set up yet rather than
 * faking the flow.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { google?: any }
}

export function GoogleButton({ isAr, onCredential }: { isAr: boolean; onCredential: (idToken: string) => void }) {
  const { toast } = useToast();
  const ref = React.useRef<HTMLDivElement>(null);
  const cbRef = React.useRef(onCredential);
  cbRef.current = onCredential;

  React.useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;
    let cancelled = false;

    const init = () => {
      if (cancelled || !window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp: { credential: string }) => cbRef.current(resp.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
        locale: isAr ? "ar" : "en",
      });
    };

    if (window.google) {
      init();
    } else {
      const existing = document.getElementById("gsi-script");
      if (existing) {
        existing.addEventListener("load", init);
      } else {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.defer = true;
        s.id = "gsi-script";
        s.onload = init;
        document.head.appendChild(s);
      }
    }
    return () => { cancelled = true; };
  }, [isAr]);

  if (CLIENT_ID) {
    // Google renders its own compliant button into this container.
    return <div ref={ref} className="flex min-h-[44px] justify-center" />;
  }

  // Not configured — a branded, honest button.
  return (
    <button
      type="button"
      onClick={() =>
        toast({
          title: isAr ? "الدخول عبر Google غير مُفعّل بعد" : "Google sign-in isn't set up yet",
          description: isAr ? "استخدم البريد أو رقم الجوال الآن." : "Use email or mobile number for now.",
        })
      }
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-input bg-background text-sm font-medium shadow-e1 transition-colors hover:bg-muted"
    >
      <GoogleGlyph />
      {isAr ? "المتابعة عبر Google" : "Continue with Google"}
    </button>
  );
}

function GoogleGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
