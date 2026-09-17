"use client";

import * as React from "react";
import { CreditCard, Check } from "lucide-react";
import { cn } from "@moraqat/ui";

/**
 * Payment rails the member can choose at checkout (T7, D10).
 *
 *  - CARD      → mada / Visa / Mastercard through the embedded Moyasar form.
 *                The only rail that can renew itself (opt-in).
 *  - APPLE_PAY → shown only where the browser can actually offer it.
 *  - TAMARA    → pay in full or in instalments on Tamara's page. Never renews
 *                itself (BNPL underwrites every order individually).
 *
 * The API key for the card rail is MADA: the brand the PSP reports at capture
 * is what ends up on the payment and the saved card (webhooks.service).
 */
export type CheckoutProvider = "MADA" | "APPLE_PAY" | "TAMARA";

export function ProviderPicker({
  value,
  onChange,
  isAr,
  applePayAvailable,
}: {
  value: CheckoutProvider;
  onChange: (p: CheckoutProvider) => void;
  isAr: boolean;
  applePayAvailable: boolean;
}) {
  const options: { key: CheckoutProvider; title: string; hint: string; badge: React.ReactNode }[] = [
    {
      key: "MADA",
      title: isAr ? "بطاقة — مدى، فيزا، ماستركارد" : "Card — mada, Visa, Mastercard",
      hint: isAr ? "تدفع الآن. وإذا حبيت، تخلّيها تتجدد تلقائياً." : "Pay now. And if you like, let it renew itself.",
      badge: (
        <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
          <CreditCard className="size-5" aria-hidden />
        </span>
      ),
    },
    ...(applePayAvailable
      ? [
          {
            key: "APPLE_PAY" as const,
            title: "Apple Pay",
            hint: isAr ? "بضغطة من جهازك — بدون إدخال بطاقة." : "One tap from your device — no card to type.",
            badge: (
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-foreground text-background text-xs font-semibold" dir="ltr">
                 Pay
              </span>
            ),
          },
        ]
      : []),
    {
      key: "TAMARA",
      title: isAr ? "تمارا — كامل أو أقساط" : "Tamara — in full or instalments",
      hint: isAr
        ? "تختار الطريقة في صفحة تمارا (حسب الأهلية). لا يتجدد تلقائياً."
        : "You choose on Tamara's page (subject to eligibility). Never renews itself.",
      badge: (
        <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-primary px-1 text-[11px] font-bold lowercase tracking-tight text-primary-foreground">
          tamara
        </span>
      ),
    },
  ];

  return (
    <div role="radiogroup" aria-label={isAr ? "طريقة الدفع" : "Payment method"} className="space-y-2">
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.key)}
            className={cn(
              "flex w-full min-h-11 items-center gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/50"
            )}
          >
            {o.badge}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{o.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{o.hint}</span>
            </span>
            <span
              aria-hidden
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
              )}
            >
              {selected && <Check className="size-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Apple Pay is only offered where the browser can actually present it. */
export function useApplePayAvailable(): boolean {
  const [ok, setOk] = React.useState(false);
  React.useEffect(() => {
    const w = window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } };
    try {
      setOk(!!w.ApplePaySession?.canMakePayments?.());
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}
