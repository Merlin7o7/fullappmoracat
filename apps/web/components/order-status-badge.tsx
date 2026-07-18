"use client";

import { Badge } from "@moraqat/ui";

const MAP: Record<string, { variant: "success" | "default" | "destructive" | "secondary" | "warning"; en: string; ar: string }> = {
  CONFIRMED: { variant: "success", en: "Confirmed", ar: "مؤكد" },
  DELIVERED: { variant: "success", en: "Delivered", ar: "تم التوصيل" },
  SHIPPED: { variant: "default", en: "Shipped", ar: "تم الشحن" },
  OUT_FOR_DELIVERY: { variant: "default", en: "Out for delivery", ar: "قيد التوصيل" },
  PROCESSING: { variant: "secondary", en: "Processing", ar: "قيد المعالجة" },
  PENDING: { variant: "secondary", en: "Pending", ar: "معلّق" },
  CANCELLED: { variant: "destructive", en: "Cancelled", ar: "ملغى" },
  // Calm, factual — a failed payment is a recovery moment, not an alarm (R118).
  FAILED: { variant: "warning", en: "Payment didn't complete", ar: "لم يكتمل الدفع" },
  // A refund is a kept promise (R030) — never styled as an error.
  REFUNDED: { variant: "secondary", en: "Refunded", ar: "تم الاسترداد" },
};

export function OrderStatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const s = MAP[status] ?? { variant: "secondary" as const, en: status, ar: status };
  return <Badge variant={s.variant}>{isAr ? s.ar : s.en}</Badge>;
}
