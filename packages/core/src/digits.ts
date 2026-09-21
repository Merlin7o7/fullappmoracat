/**
 * Digits as people actually type them. An Arabic keyboard produces Arabic-Indic
 * numerals (٠–٩) and a Persian/Urdu one produces Eastern-Arabic (۰–۹); a field
 * that silently drops them locks an Arabic-first member out of their own form
 * (R101, R115). Every numeric input normalises through here before validating.
 */

/** Arabic-Indic and Eastern-Arabic digits → Latin, so ٠٥٥ matches 055. */
export function latinizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** Only the digits of `input`, in Latin form — any script accepted on the way in. */
export function digitsOnly(input: string): string {
  return latinizeDigits(input).replace(/\D/g, "");
}

/**
 * A decimal number as typed, in Latin form: any-script digits plus one decimal
 * point. The Arabic decimal separator (٫) and a comma both read as the point.
 */
export function decimalOnly(input: string): string {
  const cleaned = latinizeDigits(input).replace(/[٫,]/g, ".").replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}
