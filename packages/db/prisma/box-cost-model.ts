import { DEFAULT_COST_MODEL, type BoxCostModel } from "@moraqat/core";

/**
 * Operational cost assumptions used to validate plan economics.
 *
 * Defaults are the MRC-FIN-002 (2026-07-23) planning figures: packaging 12
 * (5-ply mailer — boxes carry an ~8kg litter bag), delivery 32 (Riyadh courier
 * estimate for a ≤15kg parcel — replace with a real quote after the hand-pack),
 * fulfilment 8, PSP 2.5% (mada-default rail; BNPL is an option, not the door).
 * Every one is an environment override because these are commercial facts that
 * change with a carrier contract or a PSP rate — not constants to bake in.
 *
 * `deliverySar` remains the most sensitive input: it decides whether the
 * 199/219/329/479 price points clear their floors. The previous defaults
 * (9/12/6) were the old optimistic model and understated cost by ~25 SAR/box.
 */
export const BOX_COST_MODEL: BoxCostModel = {
  packagingSar: num("BOX_PACKAGING_SAR", DEFAULT_COST_MODEL.packagingSar),
  deliverySar: num("BOX_DELIVERY_SAR", DEFAULT_COST_MODEL.deliverySar),
  fulfilmentSar: num("BOX_FULFILMENT_SAR", DEFAULT_COST_MODEL.fulfilmentSar),
  pspRate: num("BOX_PSP_RATE", DEFAULT_COST_MODEL.pspRate),
  shrinkRate: num("BOX_SHRINK_RATE", DEFAULT_COST_MODEL.shrinkRate),
};

function num(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
