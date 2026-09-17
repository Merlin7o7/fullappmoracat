/**
 * Cancel reasons (T8). Asked once, as a courtesy to the founder, never argued
 * with (R063/R068): every option is a legitimate reason, and "a cat passed
 * away" gets its own gentle acknowledgement rather than a retention pitch.
 */
export const CANCEL_REASONS = [
  "TOO_EXPENSIVE",
  "MOVING",
  "CAT_PASSED",
  "NOT_USING",
  "SERVICE_ISSUE",
  "OTHER",
] as const;

export type CancelReasonCode = (typeof CANCEL_REASONS)[number];

export const CANCEL_REASON_LABELS: Record<CancelReasonCode, { ar: string; en: string }> = {
  TOO_EXPENSIVE: { ar: "السعر أعلى مما أقدر عليه الآن", en: "It's more than I can spend right now" },
  MOVING: { ar: "أنتقل أو أسافر", en: "I'm moving or travelling" },
  CAT_PASSED: { ar: "قطي توفّي", en: "My cat passed away" },
  NOT_USING: { ar: "ما أستخدم الصندوق كفاية", en: "I'm not using the box enough" },
  SERVICE_ISSUE: { ar: "واجهت مشكلة في الخدمة", en: "I had a problem with the service" },
  OTHER: { ar: "سبب آخر", en: "Something else" },
};

export function isCancelReason(v: unknown): v is CancelReasonCode {
  return typeof v === "string" && (CANCEL_REASONS as readonly string[]).includes(v);
}
