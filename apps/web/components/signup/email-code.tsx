"use client";

import * as React from "react";
import { OtpBoxes } from "@/components/otp-boxes";
import { ApiError } from "@/lib/http";
import { friendlyError } from "@/lib/errors";

/**
 * The emailed 6-digit code, shared by /login and /register (one door, two
 * reasons to walk through it). Arabic-Indic digits are accepted by OtpBoxes;
 * the resend button counts down instead of failing on the server's cooldown.
 */

export const RESEND_COOLDOWN_S = 60;

/** A per-second countdown that starts when a code is sent. */
export function useResendCooldown(seconds = RESEND_COOLDOWN_S) {
  const [left, setLeft] = React.useState(0);
  React.useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return { left, start: React.useCallback(() => setLeft(seconds), [seconds]) };
}

/**
 * Member-facing copy for a failed send/verify. Distinguishes "your connection
 * dropped" from "that code isn't right" (R112 — every error is a recovery,
 * never a riddle), and never shows the raw English server string (R084).
 */
export function codeErrorMessage(err: unknown, isAr: boolean): { message: string; code?: string; network: boolean } {
  if (err instanceof ApiError && (err.kind === "network" || err.kind === "timeout")) {
    return {
      network: true,
      message: isAr
        ? "ما وصلنا للخادم — تأكد من اتصالك وجرّب مرة ثانية. رمزك ما زال صالحاً."
        : "We couldn't reach the server — check your connection and try again. Your code is still valid.",
    };
  }
  // The per-IP throttle answers 429 without a code — it is still "slow down".
  if (err instanceof ApiError && err.status === 429) {
    return {
      network: false,
      code: "OTP_RATE_LIMITED",
      message: isAr
        ? "محاولات كثيرة خلال وقت قصير. انتظر دقيقة وجرّب مرة ثانية."
        : "A few too many tries in a short time. Wait a minute and try again.",
    };
  }
  const fe = friendlyError(err, isAr);
  if (fe.code === "OTP_INVALID" || fe.code === "OTP_EXPIRED") {
    return {
      network: false,
      code: fe.code,
      message: isAr
        ? "الرمز ما ضبط أو انتهى. اطلب رمزاً جديداً من الزر تحت."
        : "That code didn't match, or it expired. Ask for a new one with the button below.",
    };
  }
  return { network: false, code: fe.code, message: fe.message };
}

export function CodeEntry({
  email,
  isAr,
  code,
  onCode,
  onComplete,
  busy,
  error,
  devCode,
  resendLeft,
  onResend,
  onChangeEmail,
  children,
}: {
  email: string;
  isAr: boolean;
  code: string;
  onCode: (v: string) => void;
  onComplete: (v: string) => void;
  busy: boolean;
  /** Already-localized error copy, or a node with a recovery link. */
  error: React.ReactNode;
  devCode?: string | null;
  resendLeft: number;
  onResend: () => void;
  onChangeEmail: () => void;
  /** The primary action (e.g. "Confirm and issue"), rendered under the boxes. */
  children?: React.ReactNode;
}) {
  const t = (ar: string, en: string) => (isAr ? ar : en);
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {t("أرسلنا رمزاً من 6 أرقام إلى ", "We sent a 6-digit code to ")}
        <span dir="ltr" className="font-medium">{email.trim()}</span>
      </p>
      <OtpBoxes value={code} onChange={onCode} onComplete={onComplete} disabled={busy} isAr={isAr} autoFocus />
      {devCode && <p className="text-xs text-muted-foreground" dir="ltr">dev code: {devCode}</p>}
      {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
      {children}
      <div className="flex flex-wrap gap-x-4 text-sm">
        <button
          type="button"
          className="min-h-11 text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline"
          disabled={busy || resendLeft > 0}
          onClick={onResend}
        >
          {resendLeft > 0
            ? t(`أرسل الرمز مرة ثانية بعد ${resendLeft} ث`, `Send it again in ${resendLeft}s`)
            : t("أرسل الرمز مرة ثانية", "Send it again")}
        </button>
        <button type="button" className="min-h-11 text-muted-foreground underline-offset-4 hover:underline" onClick={onChangeEmail}>
          {t("غيّر البريد", "Change email")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("ما وصلك؟ شيّك على مجلد الرسائل غير المرغوبة.", "Nothing yet? Check your spam folder.")}
      </p>
    </div>
  );
}

export const EMAIL_RE = /^\S+@\S+\.\S+$/;
