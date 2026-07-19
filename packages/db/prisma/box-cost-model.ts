import { DEFAULT_COST_MODEL, type BoxCostModel } from "@moraqat/core";

/**
 * Operational cost assumptions used to validate plan economics.
 *
 * Defaults come from the project's own financial model
 * (apps/web/lib/pricing-engine.ts), not from invention. Every one is an
 * environment override because these are commercial facts that change with a
 * carrier contract or a PSP rate — not constants to bake into code.
 *
 * `deliverySar` is the single most sensitive input: it decides whether the
 * current 249/349/529 price points clear the margin floor at all. It needs a
 * real 3PL quote for a ~12kg box (the Standard box carries a 10L litter bag),
 * and note the storefront currently charges customers 25 SAR for shipping,
 * which is a materially different number from the 12 assumed here.
 */
export const BOX_COST_MODEL: BoxCostModel = {
  packagingSar: num("BOX_PACKAGING_SAR", 9),
  deliverySar: num("BOX_DELIVERY_SAR", 12),
  fulfilmentSar: num("BOX_FULFILMENT_SAR", 6),
  pspRate: num("BOX_PSP_RATE", DEFAULT_COST_MODEL.pspRate),
  shrinkRate: num("BOX_SHRINK_RATE", DEFAULT_COST_MODEL.shrinkRate),
};

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
