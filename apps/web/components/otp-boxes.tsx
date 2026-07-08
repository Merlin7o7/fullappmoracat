"use client";

import * as React from "react";
import { cn } from "@moraqat/ui";

/**
 * Six separate OTP boxes. Auto-advances, supports backspace, arrow keys, and
 * pasting a full 6-digit code. Numeric keyboard on mobile. Calls onComplete when
 * all six digits are present.
 */
export function OtpBoxes({
  value,
  onChange,
  onComplete,
  disabled,
  isAr,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  isAr?: boolean;
  /** Focus the first box on mount so the member can type immediately (R002). */
  autoFocus?: boolean;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = React.useMemo(() => value.padEnd(6, " ").slice(0, 6).split(""), [value]);

  React.useEffect(() => {
    if (autoFocus && !disabled) refs.current[0]?.focus();
    // Only on mount — re-focusing on every keystroke would fight the auto-advance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setAt(i: number, d: string) {
    const arr = value.padEnd(6, " ").slice(0, 6).split("");
    arr[i] = d;
    const next = arr.join("").replace(/\s/g, "");
    onChange(next);
    return next;
  }

  function handleInput(i: number, raw: string) {
    const d = raw.replace(/\D/g, "");
    if (!d) return;
    if (d.length > 1) {
      // Pasted / multi-char — distribute from this box.
      const arr = value.padEnd(6, " ").slice(0, 6).split("");
      for (let k = 0; k < d.length && i + k < 6; k++) arr[i + k] = d[k]!;
      const next = arr.join("").replace(/\s/g, "");
      onChange(next);
      const last = Math.min(i + d.length, 6) - 1;
      refs.current[Math.min(last + 1, 5)]?.focus();
      if (next.length === 6) onComplete?.(next);
      return;
    }
    const next = setAt(i, d);
    if (i < 5) refs.current[i + 1]?.focus();
    if (next.length === 6) onComplete?.(next);
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]?.trim()) setAt(i, "");
      else if (i > 0) {
        refs.current[i - 1]?.focus();
        setAt(i - 1, "");
      }
    } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  }

  return (
    <div className="flex gap-2" dir="ltr" role="group" aria-label={isAr ? "رمز التحقق" : "Verification code"}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? 6 : 1}
          value={digits[i]?.trim() ?? ""}
          disabled={disabled}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`${isAr ? "الرقم" : "Digit"} ${i + 1}`}
          className={cn(
            "size-12 rounded-xl border border-input bg-card text-center font-mono text-xl font-semibold tabular-nums outline-none transition",
            "focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background",
            "disabled:opacity-60 sm:size-14"
          )}
        />
      ))}
    </div>
  );
}
