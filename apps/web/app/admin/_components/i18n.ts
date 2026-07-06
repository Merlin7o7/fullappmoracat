"use client";

/**
 * Shared bilingual helpers for the admin surface. Admin is Arabic-first
 * (R101) but staff-facing, so strings stay terse. Pages read `isAr` from
 * useLocale() and pass it here.
 */

/** Locale-aware date formatting (numerals + calendar per locale). */
export function fmtDate(d: string | Date, isAr: boolean, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString(isAr ? "ar-SA" : "en-GB", opts ?? { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: string | Date, isAr: boolean) {
  return new Date(d).toLocaleString(isAr ? "ar-SA" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Locale-aware number formatting (Arabic-Indic numerals in ar). */
export function fmtNum(n: number, isAr: boolean) {
  return n.toLocaleString(isAr ? "ar-SA" : "en-US");
}

/** ENUM_LIKE_LABEL → "Enum Like Label" (English fallback). */
export function titleCase(s: string) {
  return s
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

/** Customer / account status → bilingual label + Badge variant. */
export function statusMeta(status: string): { variant: "success" | "destructive" | "warning" | "secondary"; en: string; ar: string } {
  switch (status) {
    case "ACTIVE":
      return { variant: "success", en: "Active", ar: "نشط" };
    case "SUSPENDED":
      return { variant: "destructive", en: "Suspended", ar: "موقوف" };
    case "PENDING":
      return { variant: "warning", en: "Pending", ar: "معلّق" };
    case "DEACTIVATED":
      return { variant: "secondary", en: "Deactivated", ar: "معطّل" };
    default:
      return { variant: "secondary", en: titleCase(status), ar: status };
  }
}

/** Order status → bilingual label. */
const ORDER_STATUS_AR: Record<string, string> = {
  PENDING: "قيد الانتظار",
  CONFIRMED: "مؤكد",
  PROCESSING: "قيد المعالجة",
  PACKED: "مُجهّز",
  SHIPPED: "تم الشحن",
  OUT_FOR_DELIVERY: "خارج للتوصيل",
  DELIVERED: "تم التوصيل",
  CANCELLED: "ملغى",
  RETURNED: "مُرتجع",
  FAILED: "فشل",
};

export function orderStatusLabel(status: string, isAr: boolean) {
  return isAr ? ORDER_STATUS_AR[status] ?? status : titleCase(status);
}
