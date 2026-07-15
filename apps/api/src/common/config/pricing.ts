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
 * Split a customer-facing (VAT-inclusive) gross amount into net + tax.
 * With VAT_RATE=0 this returns { net: gross, tax: 0 } — no VAT anywhere.
 */
export function splitVat(gross: number): { net: number; tax: number } {
  const net = Math.round((gross / (1 + VAT_RATE)) * 100) / 100;
  const tax = Math.round((gross - net) * 100) / 100;
  return { net, tax };
}

/** Minimum committed subscription length, in months (KSA policy). */
export const MIN_TERM_MONTHS: number = (() => {
  const n = Number(process.env.MIN_TERM_MONTHS);
  return Number.isInteger(n) && n >= 1 ? n : 3;
})();

/** Subscription term options offered to members (months). First is the default. */
export const TERM_OPTIONS = [3, 6, 12] as const;
export type TermMonths = (typeof TERM_OPTIONS)[number];
