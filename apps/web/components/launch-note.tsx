"use client";

/**
 * First-box launch note — "you're among the first care plans, here's when your
 * box arrives". (Not the founding-member status: that comes from the Cat ID's
 * own number, never from buying a plan.) Reads the central launch config; auto-retires after the
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
      className={`rounded-2xl border border-primary/25 bg-primary/[0.05] p-4 sm:p-5 ${className}`}
      role="status"
    >
      <p className="flex items-start gap-2.5 text-sm font-semibold">
        <PartyPopper className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {isAr ? "من أوائل خطط العناية في مرقط." : "Among the first Moracat care plans."}
      </p>
      <p className="mt-2 flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
        <PackageCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {isAr
          ? `أول صندوق في خطة العناية يُشحن للتوصيل ابتداءً من ${date}. بعدها تصلك الصناديق حسب جدولك المختار.`
          : `Your first care-plan box ships for delivery starting ${date}. After that, boxes arrive on your chosen schedule.`}
      </p>
    </div>
  );
}
