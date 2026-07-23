/**
 * Box economics — the authoritative model for what a subscription box costs,
 * what it is worth, and whether it may be sold.
 *
 * v2 (MRC-FIN-002, 2026-07-23). The value invariant is now judged against the
 * MARKET, not our own shelf. v1 compared the box to our own store at a blanket
 * 2.8× markup — arithmetically true, commercially fictional: members price-check
 * against Petzone/Amazon.sa, and at market prices every v1 box cost 34–45% MORE
 * than its contents (MRC-FIN-001). The five-store market sweep is now a first-
 * class input (`unitMarket`), refreshed quarterly.
 *
 * Four invariants govern every plan:
 *   1. MARKET VALUE — the box may not exceed its market-benchmark basket by
 *      more than the tier's declared band. Tiers that make a savings claim in
 *      copy must actually save (Complete ≥ +3%, Signature ≥ +8%); the necessity
 *      tier may sit slightly above market (≤ +10%) but then makes NO savings
 *      claim anywhere (R006).
 *   2. GROSS MARGIN — (price − goods) / price ≥ 40% (industry floor below which
 *      a physical subscription compounds against you).
 *   3. CONTRIBUTION — after ops, payment fees and shrink.
 *   4. CONTRIBUTION POST-VAT — same, after mandatory VAT registration, which
 *      arrives at ~90 households (SAR 375k rolling). Prices are VAT-inclusive,
 *      so registration removes margin, not raises prices.
 *
 * A plan may ship while violating a floor ONLY via an explicit, reasoned
 * `acceptedViolations` waiver in its definition (e.g. the Kitten acquisition
 * tier, or pre-negotiation COGS) — printed loudly at seed time, never silent.
 */

export interface BoxCostModel {
  /** Shipping box, tissue, sticker, inserts, the printed Cat ID card. */
  packagingSar: number;
  /** Last-mile per shipment. Boxes are heavy (a 10L litter bag is ~8kg). */
  deliverySar: number;
  /** Pick/pack labour and handling. */
  fulfilmentSar: number;
  /** Payment processing, as a fraction of gross. Modeled on the default rail
   *  (mada via tokenizing PSP ≈ 2.5% blended); BNPL runs ~6.5% and is an
   *  option, not the door. */
  pspRate: number;
  /** Damage, spoilage and miscount, as a fraction of goods cost. */
  shrinkRate: number;
}

export interface BoxInvariants {
  /**
   * Minimum saving vs the MARKET benchmark basket, as a fraction of the market
   * value. May be negative: -0.10 permits a necessity tier to sit up to 10%
   * above market (it sells delivery + reliability, and makes no savings claim).
   */
  minMarketSaving: number;
  /** Gross-margin floor: (price − goods) / price. */
  minGrossMargin: number;
  /** Contribution floor before VAT registration. */
  minContribution: number;
  /** Contribution floor after VAT registration (the one that matters). */
  minContributionPostVat: number;
  /** Statutory VAT rate to stress against regardless of today's VAT_RATE. */
  stressVatRate: number;
}

export interface RecipeLine {
  sku: string;
  quantity: number;
  /** Supplier cost per unit. */
  unitCost: number;
  /** Our own à-la-carte shelf price per unit (in-app ledger, R041). */
  unitRetail: number;
  /**
   * KSA market benchmark price per unit — the member's real alternative
   * (quarterly five-store sweep, MRC-FIN-001 dataset). Falls back to
   * `unitRetail` when no benchmark exists for the SKU.
   */
  unitMarket?: number;
}

export interface BoxEconomics {
  /** What the same items cost bought individually from our store. */
  retailValue: number;
  /** What the same items cost at the KSA market benchmark. */
  marketValue: number;
  boxPrice: number;
  /** Saving vs our own store (in-app ledger). */
  memberSavings: number;
  savingsPct: number;
  /** Saving vs the market benchmark — the honest, advertisable number. */
  marketSavings: number;
  marketSavingsPct: number;

  goodsCost: number;
  grossMarginPct: number;
  shrink: number;
  packaging: number;
  delivery: number;
  fulfilment: number;
  paymentFee: number;
  totalCost: number;

  contribution: number;
  contributionPct: number;

  /** Same box after VAT registration, since prices are VAT-inclusive. */
  vatRegistered: {
    vatRate: number;
    netRevenue: number;
    vatDue: number;
    contribution: number;
    contributionPct: number;
  };
}

export const DEFAULT_COST_MODEL: BoxCostModel = {
  packagingSar: 12,
  deliverySar: 32,
  fulfilmentSar: 8,
  pspRate: 0.025,
  shrinkRate: 0.02,
};

export const DEFAULT_INVARIANTS: BoxInvariants = {
  minMarketSaving: -0.1,
  minGrossMargin: 0.4,
  minContribution: 0.16,
  minContributionPostVat: 0.1,
  stressVatRate: 0.15,
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const marketOf = (l: RecipeLine): number => l.unitMarket ?? l.unitRetail;

export function computeBoxEconomics(input: {
  recipe: RecipeLine[];
  boxPrice: number;
  costModel?: BoxCostModel;
  stressVatRate?: number;
}): BoxEconomics {
  const cm = input.costModel ?? DEFAULT_COST_MODEL;
  const stressVatRate = input.stressVatRate ?? DEFAULT_INVARIANTS.stressVatRate;

  const retailValue = round2(
    input.recipe.reduce((sum, l) => sum + l.unitRetail * l.quantity, 0)
  );
  const marketValue = round2(
    input.recipe.reduce((sum, l) => sum + marketOf(l) * l.quantity, 0)
  );
  const goodsCost = round2(input.recipe.reduce((sum, l) => sum + l.unitCost * l.quantity, 0));

  const shrink = round2(goodsCost * cm.shrinkRate);
  const paymentFee = round2(input.boxPrice * cm.pspRate);
  const totalCost = round2(
    goodsCost + shrink + cm.packagingSar + cm.deliverySar + cm.fulfilmentSar + paymentFee
  );

  const contribution = round2(input.boxPrice - totalCost);
  const memberSavings = round2(retailValue - input.boxPrice);
  const marketSavings = round2(marketValue - input.boxPrice);

  // Prices are VAT-inclusive, so registering removes the VAT share from
  // revenue rather than adding it to the customer's bill.
  const netRevenue = round2(input.boxPrice / (1 + stressVatRate));
  const vatDue = round2(input.boxPrice - netRevenue);
  const vatContribution = round2(contribution - vatDue);

  return {
    retailValue,
    marketValue,
    boxPrice: round2(input.boxPrice),
    memberSavings,
    savingsPct: retailValue > 0 ? round2(memberSavings / retailValue) : 0,
    marketSavings,
    marketSavingsPct: marketValue > 0 ? round2(marketSavings / marketValue) : 0,
    goodsCost,
    grossMarginPct:
      input.boxPrice > 0 ? round2((input.boxPrice - goodsCost) / input.boxPrice) : 0,
    shrink,
    packaging: cm.packagingSar,
    delivery: cm.deliverySar,
    fulfilment: cm.fulfilmentSar,
    paymentFee,
    totalCost,
    contribution,
    contributionPct: input.boxPrice > 0 ? round2(contribution / input.boxPrice) : 0,
    vatRegistered: {
      vatRate: stressVatRate,
      netRevenue,
      vatDue,
      contribution: vatContribution,
      contributionPct: input.boxPrice > 0 ? round2(vatContribution / input.boxPrice) : 0,
    },
  };
}

export type InvariantKind =
  | "MARKET_VALUE"
  | "GROSS_MARGIN"
  | "CONTRIBUTION"
  | "CONTRIBUTION_POST_VAT";

export interface InvariantViolation {
  invariant: InvariantKind;
  message: string;
  actual: number;
  required: number;
}

/**
 * Check a plan against all four invariants. Returns every violation rather than
 * the first, so a retune shows the whole picture instead of one error at a time.
 */
export function checkBoxInvariants(
  econ: BoxEconomics,
  inv: BoxInvariants = DEFAULT_INVARIANTS
): InvariantViolation[] {
  const out: InvariantViolation[] = [];

  if (econ.marketSavingsPct < inv.minMarketSaving) {
    const over = Math.abs(econ.marketSavings);
    out.push({
      invariant: "MARKET_VALUE",
      actual: econ.marketSavingsPct,
      required: inv.minMarketSaving,
      message:
        econ.marketSavings < 0
          ? `Box is ${over} SAR (${Math.abs(econ.marketSavingsPct * 100).toFixed(1)}%) ABOVE its market-benchmark basket (${econ.marketValue} SAR); this tier's band allows ${(inv.minMarketSaving * 100).toFixed(0)}%. Members price-check the market, not our shelf.`
          : `Box saves only ${(econ.marketSavingsPct * 100).toFixed(1)}% vs the market basket (${econ.marketValue} SAR); this tier's band requires ${(inv.minMarketSaving * 100).toFixed(0)}%.`,
    });
  }

  if (econ.grossMarginPct < inv.minGrossMargin) {
    out.push({
      invariant: "GROSS_MARGIN",
      actual: econ.grossMarginPct,
      required: inv.minGrossMargin,
      message: `Gross margin ${(econ.grossMarginPct * 100).toFixed(1)}% is below the ${(inv.minGrossMargin * 100).toFixed(0)}% floor (goods ${econ.goodsCost} SAR on a ${econ.boxPrice} SAR box). Below this floor a physical subscription compounds against you.`,
    });
  }

  if (econ.contributionPct < inv.minContribution) {
    out.push({
      invariant: "CONTRIBUTION",
      actual: econ.contributionPct,
      required: inv.minContribution,
      message: `Contribution margin ${(econ.contributionPct * 100).toFixed(1)}% is below the ${(inv.minContribution * 100).toFixed(0)}% floor (contribution ${econ.contribution} SAR on a ${econ.boxPrice} SAR box).`,
    });
  }

  if (econ.vatRegistered.contributionPct < inv.minContributionPostVat) {
    out.push({
      invariant: "CONTRIBUTION_POST_VAT",
      actual: econ.vatRegistered.contributionPct,
      required: inv.minContributionPostVat,
      message: `After VAT registration at ${(econ.vatRegistered.vatRate * 100).toFixed(0)}% contribution falls to ${(econ.vatRegistered.contributionPct * 100).toFixed(1)}% (${econ.vatRegistered.contribution} SAR). Registration arrives at ~90 households (SAR 375k rolling) — pricing must survive it.`,
    });
  }

  return out;
}

/**
 * Economics of ONE additional cat added to a household box (MRC-FIN-002 §5).
 * The module ships inside the household's parcel(s): it pays only the
 * INCREMENTAL logistics (extra weight/parcel share), never a full box's fixed
 * costs — that shared-cost pool is exactly where the per-cat discount comes
 * from, so the module must still be profitable on its own.
 */
export function computeModuleEconomics(input: {
  /** The per-cat consumable lines (PlanContent.perCat) for this tier. */
  perCatRecipe: RecipeLine[];
  /** Price of each additional cat (Plan.modulePriceSar). */
  modulePrice: number;
  /** Incremental logistics for one more cat's weight (≈ +4 packaging, +15 delivery share, +2 fulfilment). */
  incrementalPackagingSar?: number;
  incrementalDeliverySar?: number;
  incrementalFulfilmentSar?: number;
  costModel?: BoxCostModel;
  stressVatRate?: number;
}): {
  goodsCost: number;
  marketValue: number;
  contribution: number;
  contributionPct: number;
  vatContribution: number;
  vatContributionPct: number;
} {
  const cm = input.costModel ?? DEFAULT_COST_MODEL;
  const stressVatRate = input.stressVatRate ?? DEFAULT_INVARIANTS.stressVatRate;
  const goods = round2(input.perCatRecipe.reduce((s, l) => s + l.unitCost * l.quantity, 0));
  const marketValue = round2(
    input.perCatRecipe.reduce((s, l) => s + marketOf(l) * l.quantity, 0)
  );
  const cost =
    goods * (1 + cm.shrinkRate) +
    (input.incrementalPackagingSar ?? 4) +
    (input.incrementalDeliverySar ?? 15) +
    (input.incrementalFulfilmentSar ?? 2) +
    input.modulePrice * cm.pspRate;
  const contribution = round2(input.modulePrice - cost);
  const vatDue = round2(input.modulePrice - input.modulePrice / (1 + stressVatRate));
  const vatContribution = round2(contribution - vatDue);
  return {
    goodsCost: goods,
    marketValue,
    contribution,
    contributionPct: input.modulePrice > 0 ? round2(contribution / input.modulePrice) : 0,
    vatContribution,
    vatContributionPct:
      input.modulePrice > 0 ? round2(vatContribution / input.modulePrice) : 0,
  };
}

/**
 * Lowest price at which a recipe clears EVERY margin floor (gross margin,
 * contribution, and post-VAT contribution). Use to price a new plan from its
 * contents rather than guessing a number and discovering the margin later.
 */
export function minimumViablePrice(
  recipe: RecipeLine[],
  costModel: BoxCostModel = DEFAULT_COST_MODEL,
  inv: BoxInvariants = DEFAULT_INVARIANTS
): number {
  const goodsCost = recipe.reduce((s, l) => s + l.unitCost * l.quantity, 0);
  const fixed =
    goodsCost * (1 + costModel.shrinkRate) +
    costModel.packagingSar +
    costModel.deliverySar +
    costModel.fulfilmentSar;

  // GROSS_MARGIN: price ≥ goods / (1 − minGrossMargin)
  const fromGm = goodsCost / (1 - inv.minGrossMargin);

  // CONTRIBUTION: price − fixed − price·psp ≥ price·minContribution
  const denomPre = 1 - costModel.pspRate - inv.minContribution;
  const fromPre = denomPre > 0 ? fixed / denomPre : Number.POSITIVE_INFINITY;

  // CONTRIBUTION_POST_VAT: price − fixed − price·psp − price·vatShare ≥ price·minPostVat
  const vatShare = inv.stressVatRate / (1 + inv.stressVatRate);
  const denomPost = 1 - costModel.pspRate - vatShare - inv.minContributionPostVat;
  const fromPost = denomPost > 0 ? fixed / denomPost : Number.POSITIVE_INFINITY;

  return Math.ceil(Math.max(fromGm, fromPre, fromPost));
}
