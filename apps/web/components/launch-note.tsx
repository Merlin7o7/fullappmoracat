"use client";

/**
 * Founding-member launch note — the exciting "you're first, here's when your box
 * arrives" message. Reads the central launch config; auto-retires after the
 * first-delivery date (renders nothing once we're live). Shown before payment,
 * reinforced after checkout, and on the dashboard until the first box ships.
 */
import { PartyPopper, PackageCheck } from "lucide-react";
import { isPreLaunch, firstDeliveryLabel } from "@/lib/launch";

type Variant = "full" | "inline";

export function LaunchDeliveryNote({
  isAr,
  variant = "full",
  className = "",
}: {
  isAr: boolean;
  variant?: Variant;
  className?: string;
}) {
  if (!isPreLaunch()) return null;
  const date = firstDeliveryLabel(isAr ? "ar" : "en");

  if (variant === "inline") {
    return (
      <p className={`flex items-center justify-center gap-1.5 text-xs font-medium text-primary ${className}`}>
        <PackageCheck className="size-3.5 shrink-0" aria-hidden />
        {isAr ? `أول صندوق يُشحن للتوصيل ابتداءً من ${date}` : `First box ships for delivery starting ${date}`}
      </p>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] to-card p-4 sm:p-5 ${className}`}
      role="status"
    >
      <p className="flex items-start gap-2.5 text-sm font-semibold">
        <PartyPopper className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {isAr ? "أنت تحجز مكانك كأحد أعضاء مرقط المؤسّسين." : "You're reserving your place as a Moracat founding member."}
      </p>
      <p className="mt-2 flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
        <PackageCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {isAr
          ? `أول صندوق اشتراك يُشحن للتوصيل ابتداءً من ${date}. بعدها تصلك الصناديق حسب جدولك المختار.`
          : `Your first subscription box ships for delivery starting ${date}. After that, boxes arrive on your chosen schedule.`}
      </p>
    </div>
  );
}
