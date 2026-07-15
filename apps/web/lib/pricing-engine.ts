/**
 * CENTRALIZED PRICING ENGINE — the single place operational costs, margin, and
 * VAT live. Pricing is always *generated* from this model, never hand-entered,
 * and always lands on a profitable price. INTERNAL ONLY: the cost breakdown must
 * never be shown to customers (they see the final price and value, nothing else).
 *
 * To retune the business, change these numbers in ONE place. VAT is 0 until
 * Moracat registers — flip NEXT_PUBLIC_VAT_RATE=0.15 to enable everywhere.
 */

export const PRICING_CONFIG = {
  /** Packaging per box: shipping box, tissue, sticker, inserts, Cat ID/QR card.
   *  Spec range 8–10 SAR — midpoint. */
  packagingSar: 9,
  /** Local Saudi last-mile per shipment. Spec range 10–15 SAR — midpoint. */
  deliverySar: 12,
  /** Per-box fulfilment labour + handling. */
  fulfilmentSar: 6,
  /** Target contribution margin the engine prices toward. */
  targetMargin: 0.28,
  /** VAT as a fraction (0 = not registered). One flip enables VAT app-wide. */
  vatRate: Number(process.env.NEXT_PUBLIC_VAT_RATE ?? 0),
} as const;

export interface BoxEconomics {
  productCogs: number;
  packaging: number;
  delivery: number;
  fulfilment: number;
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
 * covers operational cost + target margin, rounded to a clean ".x9" price point.
 */
export function recommendedPrice(productCogs: number, cfg = PRICING_CONFIG): number {
  const cost = productCogs + operationalCost(cfg);
  const raw = cost / (1 - cfg.targetMargin);
  return Math.max(1, Math.round(raw / 10) * 10 - 1);
}

/** Full per-box economics for a given price + product COGS (internal validation). */
export function boxEconomics(price: number, productCogs: number, cfg = PRICING_CONFIG): BoxEconomics {
  const packaging = cfg.packagingSar;
  const delivery = cfg.deliverySar;
  const fulfilment = cfg.fulfilmentSar;
  const totalCost = productCogs + packaging + delivery + fulfilment;
  const contribution = price - totalCost;
  return {
    productCogs,
    packaging,
    delivery,
    fulfilment,
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
