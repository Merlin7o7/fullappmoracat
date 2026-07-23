/**
 * PRICING ENGINE (legacy) — operational costs, margin, and VAT in one place.
 * INTERNAL ONLY: the cost breakdown must never be shown to customers (they see
 * the final price and value, nothing else).
 *
 * NOTE (2026-07-23): the AUTHORITATIVE economics model is now
 * `@moraqat/core` `pricing/box-economics.ts` (market-basket invariants,
 * VAT-registered stress, household modules — MRC-FIN-002). This module has no
 * importers today; its constants are kept reconciled with MRC-FIN-002 §2/§7.1
 * so it can never mislead if picked back up. Prefer the core engine.
 *
 * VAT is 0 until Moracat registers — flip NEXT_PUBLIC_VAT_RATE=0.15 to enable.
 */

export const PRICING_CONFIG = {
  /** Packaging per box: 5-ply mailer (litter weight), tissue, sticker, inserts,
   *  Cat ID/QR card. MRC-FIN-002 §2 planning figure. */
  packagingSar: 12,
  /** Local Saudi last-mile per shipment (Riyadh ≤15kg — a box is ~13–14kg).
   *  MRC-FIN-002 §2; multi-cat ≥3 cats ships extra parcels at +30 each. */
  deliverySar: 32,
  /** Per-box fulfilment labour + handling (MRC-FIN-002 §2). */
  fulfilmentSar: 8,
  /** Payment processing as a fraction of gross — mada blended (MRC-FIN-002 §2). */
  pspRate: 0.025,
  /** Target pre-VAT contribution margin the engine prices toward — the §7.1
   *  ladder lands at 24.5–27.1% contribution at 0% VAT. */
  targetMargin: 0.25,
  /** VAT as a fraction (0 = not registered). One flip enables VAT app-wide. */
  vatRate: Number(process.env.NEXT_PUBLIC_VAT_RATE ?? 0),
} as const;

export interface BoxEconomics {
  productCogs: number;
  packaging: number;
  delivery: number;
  fulfilment: number;
  paymentFee: number;
  totalCost: number;
  price: number;
  contribution: number;
  marginPct: number;
  profitable: boolean;
}

/** Fixed operational cost added to every box before margin (packaging + delivery + labour). */
export function operationalCost(cfg = PRICING_CONFIG): number {
  return cfg.packagingSar + cfg.deliverySar + cfg.fulfilmentSar;
}

/**
 * Generate a profitable monthly price from a box's real product COGS. Always
 * covers operational cost + PSP fee + target margin, rounded to a clean ".x9"
 * price point (charm-on-hundreds per MRC-FIN-002 R10 for the real ladder).
 */
export function recommendedPrice(productCogs: number, cfg = PRICING_CONFIG): number {
  const cost = productCogs + operationalCost(cfg);
  const raw = cost / (1 - cfg.targetMargin - cfg.pspRate);
  return Math.max(1, Math.round(raw / 10) * 10 - 1);
}

/** Full per-box economics for a given price + product COGS (internal validation). */
export function boxEconomics(price: number, productCogs: number, cfg = PRICING_CONFIG): BoxEconomics {
  const packaging = cfg.packagingSar;
  const delivery = cfg.deliverySar;
  const fulfilment = cfg.fulfilmentSar;
  const paymentFee = Math.round(price * cfg.pspRate * 100) / 100;
  const totalCost = productCogs + packaging + delivery + fulfilment + paymentFee;
  const contribution = price - totalCost;
  return {
    productCogs,
    packaging,
    delivery,
    fulfilment,
    paymentFee,
    totalCost,
    price,
    contribution,
    marginPct: price > 0 ? contribution / price : 0,
    profitable: contribution > 0,
  };
}

/** Split a VAT-inclusive price into net + tax. With vatRate 0 → { net: price, tax: 0 }. */
export function splitVat(price: number, cfg = PRICING_CONFIG): { net: number; tax: number } {
  if (cfg.vatRate <= 0) return { net: price, tax: 0 };
  const net = price / (1 + cfg.vatRate);
  return { net: Math.round(net * 100) / 100, tax: Math.round((price - net) * 100) / 100 };
}
