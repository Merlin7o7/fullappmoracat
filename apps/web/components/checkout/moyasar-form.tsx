"use client";

import * as React from "react";
import { Loader2, ShieldCheck, FlaskConical } from "lucide-react";
import { Button } from "@moraqat/ui";

/**
 * The embedded PSP card form (T7, D7).
 *
 * Card details go from the browser straight to Moyasar with the PUBLISHABLE
 * key — nothing card-shaped ever reaches our API. When the member opted into
 * auto-renew the form asks Moyasar to save the card; Moyasar then redirects to
 * `callbackUrl?id=<payment>` and the return page attaches that id server-side.
 *
 * `mock_form` (PAYMENTS_MODE=mock) renders a sandbox stand-in so the whole
 * ceremony — form → return → attach → active — is exercisable without keys.
 */
export interface ClientSession {
  kind: "moyasar_form" | "mock_form";
  publishableKey: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
  callbackUrl: string;
  saveCard: boolean;
  methods: ("creditcard" | "applepay")[];
}

const MPF_VERSION = "1.14.0";
const MPF_BASE = `https://cdn.moyasar.com/mpf/${MPF_VERSION}`;

declare global {
  interface Window {
    Moyasar?: { init: (cfg: Record<string, unknown>) => void };
  }
}

let loader: Promise<void> | null = null;
function loadMoyasar(): Promise<void> {
  if (window.Moyasar) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${MPF_BASE}/moyasar.css`;
    document.head.appendChild(css);
    // Inserted from our nonced bundle → trusted under strict-dynamic CSP.
    const s = document.createElement("script");
    s.src = `${MPF_BASE}/moyasar.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("moyasar.js failed to load"));
    document.head.appendChild(s);
  });
  return loader;
}

export function MoyasarForm({ session, isAr }: { session: ClientSession; isAr: boolean }) {
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const mounted = React.useRef(false);

  React.useEffect(() => {
    if (session.kind !== "moyasar_form" || mounted.current) return;
    mounted.current = true;
    let cancelled = false;
    loadMoyasar()
      .then(() => {
        if (cancelled || !window.Moyasar) return;
        window.Moyasar.init({
          element: ".mysr-form",
          amount: session.amount,
          currency: session.currency,
          description: session.description,
          publishable_api_key: session.publishableKey,
          callback_url: session.callbackUrl,
          methods: session.methods,
          save_card: session.saveCard,
          metadata: { reference: session.reference },
          language: isAr ? "ar" : "en",
          apple_pay: {
            country: "SA",
            label: "Moracat",
            validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate",
          },
        });
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [session, isAr]);

  if (session.kind === "mock_form") return <MockForm session={session} isAr={isAr} />;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0 text-success" aria-hidden />
        {isAr
          ? "بيانات بطاقتك تذهب مباشرة إلى مزوّد الدفع المرخّص (Moyasar) — لا نراها ولا نخزّنها."
          : "Your card details go straight to the licensed payment provider (Moyasar) — we never see or store them."}
      </p>
      {failed ? (
        <p role="alert" className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
          {isAr ? "تعذّر تحميل نموذج الدفع. أعد تحميل الصفحة وجرّب مرة ثانية." : "The payment form couldn't load. Reload the page and try again."}
        </p>
      ) : (
        <>
          {!ready && (
            <div className="grid h-24 place-items-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="mysr-form" dir="ltr" />
        </>
      )}
    </div>
  );
}

/** Sandbox stand-in for the PSP form — same redirect contract, no keys. */
function MockForm({ session, isAr }: { session: ClientSession; isAr: boolean }) {
  const go = (id: string) => {
    const url = new URL(session.callbackUrl);
    url.searchParams.set("id", id);
    window.location.assign(url.toString());
  };
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-4" data-testid="mock-psp-form">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FlaskConical className="size-3.5" aria-hidden />
        {isAr ? "نموذج دفع تجريبي (وضع المحاكاة)" : "Sandbox payment form (mock mode)"}
      </p>
      <p className="text-xs text-muted-foreground" dir="ltr">
        {session.reference} · {(session.amount / 100).toFixed(2)} {session.currency}
        {session.saveCard ? " · save_card" : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => go(`mockpay_${session.reference}`)}>
          {isAr ? "محاكاة دفع ناجح" : "Simulate successful payment"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => go(`mockpay_declined_${session.reference}`)}>
          {isAr ? "محاكاة رفض" : "Simulate decline"}
        </Button>
      </div>
    </div>
  );
}
