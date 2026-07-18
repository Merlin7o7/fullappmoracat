"use client";

import * as React from "react";

/**
 * "Continue with Google". When a client ID is configured we render Google's
 * official Identity Services button and hand the credential to the API.
 * Without one we render NOTHING: a dead control on the highest-intent screen
 * is worse than no control (R006 honest by default, R002 effort is the enemy).
 * Callers should also hide their "or …" divider via {@link googleEnabled}.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** True when Google sign-in is configured — gate dividers/labels on this. */
export const googleEnabled = Boolean(CLIENT_ID);

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { google?: any }
}

export function GoogleButton({ isAr, onCredential }: { isAr: boolean; onCredential: (idToken: string) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const cbRef = React.useRef(onCredential);
  cbRef.current = onCredential;
  // If the GSI script itself fails to load (blocked network, extension), the
  // container collapses instead of leaving an empty ghost slot.
  const [scriptFailed, setScriptFailed] = React.useState(false);

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
        s.onerror = () => { if (!cancelled) setScriptFailed(true); };
        document.head.appendChild(s);
      }
    }
    return () => { cancelled = true; };
  }, [isAr]);

  // Not configured (or the script never arrived) — render nothing. The member
  // sees only controls that actually work.
  if (!CLIENT_ID || scriptFailed) return null;

  // Google renders its own compliant button into this container.
  return <div ref={ref} className="flex min-h-[44px] justify-center" />;
}
