"use client";

import * as React from "react";
import { cn } from "@moraqat/ui";

/**
 * Country-code + mobile number, defaulting to Saudi Arabia (+966) — the fewest
 * possible steps for our home market (R002). Saudi sits first, then the GCC.
 */
export const DIAL_CODES = [
  { code: "+966", flag: "🇸🇦", ar: "السعودية", en: "Saudi Arabia" },
  { code: "+971", flag: "🇦🇪", ar: "الإمارات", en: "UAE" },
  { code: "+973", flag: "🇧🇭", ar: "البحرين", en: "Bahrain" },
  { code: "+974", flag: "🇶🇦", ar: "قطر", en: "Qatar" },
  { code: "+965", flag: "🇰🇼", ar: "الكويت", en: "Kuwait" },
  { code: "+968", flag: "🇴🇲", ar: "عُمان", en: "Oman" },
  { code: "+962", flag: "🇯🇴", ar: "الأردن", en: "Jordan" },
  { code: "+20", flag: "🇪🇬", ar: "مصر", en: "Egypt" },
];

interface PhoneFieldProps {
  label: string;
  dialCode: string;
  onDialCode: (v: string) => void;
  value: string;
  onValue: (v: string) => void;
  required?: boolean;
  error?: string;
  isAr: boolean;
}

/** Compose a full E.164 number from a dial code + a national number. */
export function composePhone(dialCode: string, national: string): string {
  return `${dialCode}${national.replace(/^0+/, "").replace(/[^0-9]/g, "")}`;
}

export function PhoneField({ label, dialCode, onDialCode, value, onValue, required, error, isAr }: PhoneFieldProps) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ms-0.5 text-destructive" aria-hidden>*</span>}
      </label>
      <div className={cn(
        "flex items-stretch gap-2 rounded-xl",
      )}>
        <div className="relative">
          <select
            aria-label={isAr ? "رمز الدولة" : "Country code"}
            value={dialCode}
            onChange={(e) => onDialCode(e.target.value)}
            className="h-11 rounded-xl border border-input bg-background ps-3 pe-8 text-sm shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            dir="ltr"
          >
            {DIAL_CODES.map((d) => (
              <option key={d.code} value={d.code}>{d.flag} {d.code}</option>
            ))}
          </select>
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder="5X XXX XXXX"
          dir="ltr"
          aria-invalid={!!error}
          className={cn(
            "h-11 w-full flex-1 rounded-xl border bg-background px-3 text-sm shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
            error ? "border-destructive" : "border-input"
          )}
        />
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
