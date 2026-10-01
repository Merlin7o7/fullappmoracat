/**
 * Central pricing configuration — the single source of truth for tax.
 *
 * Moracat is NOT currently VAT-registered, so VAT is 0% everywhere: no VAT is
 * added to any product, subscription, checkout, invoice, or projection. When the
 * business registers for VAT, flip ONE environment variable — `VAT_RATE=0.15` —
 * and every price surface (order totals, invoices, receipts) starts breaking the
 * 15% out automatically. No code change, no redeploy of logic.
 *
 * Prices in the catalog/plans are the amounts the customer pays. With VAT off,
 * net == gross and taxTotal == 0. With VAT on, taxTotal is derived from the
 * VAT-inclusive price so the customer-facing number never changes.
 */

/** Current VAT rate as a fraction (0 = not registered). Set env VAT_RATE to enable. */
export const VAT_RATE: number = (() => {
  const raw = process.env.VAT_RATE;
  if (raw === undefined || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n < 1 ? n : 0;
})();

/** True once Moracat is VAT-registered (drives "VAT incl." labels, ZATCA fields). */
export const VAT_ENABLED = VAT_RATE > 0;

/**
 * The seller's own registration numbers, as printed on invoices. Never
 * defaulted or invented: unset means "not registered / not yet provided" and
 * the invoice omits the line. ZATCA VAT numbers are 15 digits starting and
 * ending in 3; a Saudi CR is 10 digits. Anything else is ignored exactly like
 * unset — and /admin's readiness panel says so.
 */
function digitsEnv(name: string, pattern: RegExp): string | null {
  const raw = (process.env[name] ?? "").trim();
  return pattern.test(raw) ? raw : null;
}
export const SELLER_VAT_NUMBER: string | null = digitsEnv("VAT_NUMBER", /^3\d{13}3$/);
export const SELLER_CR_NUMBER: string | null = digitsEnv("CR_NUMBER", /^\d{10}$/);

/** Fields every new invoice carries from config (spread into invoice.create). */
export function invoiceSellerFields(): { vatNumber: string | null } {
  return { vatNumber: VAT_ENABLED ? SELLER_VAT_NUMBER : null };
}

/** "15" for 0.15 — the rate as printed beside a VAT line. */
export function vatPercentLabel(): string {
  return String(Math.round(VAT_RATE * 10000) / 100);
}

/**
 * Split a customer-facing (VAT-inclusive) gross amount into net + tax.
 * With VAT_RATE=0 this returns { net: gross, tax: 0 } — no VAT anywhere.
 */
export function splitVat(gross: number): { net: number; tax: number } {
  const net = Math.round((gross / (1 + VAT_RATE)) * 100) / 100;
  const tax = Math.round((gross - net) * 100) / 100;
  return { net, tax };
}

/** Minimum committed subscription length, in months. Members may try a single
 * month before committing longer (lower barrier to first value); 3/6/12 remain
 * the retention-friendly options. Override with env MIN_TERM_MONTHS. */
export const MIN_TERM_MONTHS: number = (() => {
  const n = Number(process.env.MIN_TERM_MONTHS);
  return Number.isInteger(n) && n >= 1 ? n : 1;
})();

/** Subscription term options offered to members (months). 3 is the recommended
 * default (pre-selected at checkout); 1 is the low-commitment entry point. */
export const TERM_OPTIONS = [1, 3, 6, 12] as const;
export type TermMonths = (typeof TERM_OPTIONS)[number];

/**
 * Prepaid-term discounts (MRC-FIN-002 §6). Deliberately shallow: at food-heavy
 * contribution margins, the market-standard −15/−25% would make long terms
 * lose money post-VAT — commitment is rewarded with gated gifts instead
 * (BarkBox pattern), and the ladder deepens after the Phase-2 COGS work.
 * Deterministic from termMonths so every surface (checkout, serializer,
 * invoice) derives the same number and nothing needs to be stored.
 */
export const TERM_DISCOUNTS: Record<TermMonths, number> = { 1: 0, 3: 0, 6: 0.05, 12: 0.08 };

/** Discount fraction for a term; unknown terms get 0 (defensive). */
export function termDiscount(termMonths: number): number {
  return TERM_DISCOUNTS[termMonths as TermMonths] ?? 0;
}

/** The exact upfront total for a term: monthly × months × (1 − discount), rounded. */
export function termTotal(monthlyPrice: number, termMonths: number): number {
  return Math.round(monthlyPrice * termMonths * (1 - termDiscount(termMonths)) * 100) / 100;
}

/** Maximum cats per household subscription (MRC-FIN-002 §5). */
export const MAX_CATS_PER_SUBSCRIPTION = 6;

/**
 * Monthly price for a household: base + module × (extra cats). Plans without a
 * module price are single-cat only (callers must reject catCount > 1).
 */
export function householdMonthlyPrice(
  basePrice: number,
  modulePrice: number | null,
  catCount: number
): number {
  const extras = Math.max(0, catCount - 1);
  return Math.round((basePrice + (modulePrice ?? 0) * extras) * 100) / 100;
}
