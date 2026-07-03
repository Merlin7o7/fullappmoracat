"use client";

import { Badge } from "@moraqat/ui";

const MAP: Record<string, { variant: "success" | "warning" | "info" | "secondary"; en: string; ar: string }> = {
  OPEN: { variant: "info", en: "Open", ar: "مفتوحة" },
  PENDING: { variant: "warning", en: "Awaiting reply", ar: "بانتظار الرد" },
  RESOLVED: { variant: "success", en: "Resolved", ar: "محلولة" },
  CLOSED: { variant: "secondary", en: "Closed", ar: "مغلقة" },
};

export function TicketStatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const s = MAP[status] ?? { variant: "secondary" as const, en: status, ar: status };
  return <Badge dot variant={s.variant}>{isAr ? s.ar : s.en}</Badge>;
}
