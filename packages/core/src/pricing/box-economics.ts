/**
 * Box economics — the authoritative model for what a subscription box costs,
 * what it is worth, and whether it may be sold.
 *
 * Two invariants govern every plan. They exist because violating either one is
 * silently fatal:
 *
 *   1. VALUE — the box must cost the member LESS than buying the same items
 *      à-la-carte from our own store. A box priced above its own contents has
 *      no reason to exist, cannot honestly advertise a saving, and loses any
 *      price-checking customer at term end. (This was live: Starter cost 35%
 *      MORE than its contents.)
 *
 *   2. MARGIN — contribution must stay healthy AFTER operational cost, payment
 *      fees, shrink, and — critically — after VAT registration. Registration is
 *      mandatory above SAR 375k of rolling supplies, and because prices are
 *      VAT-INCLUSIVE, registering does not raise the price: it removes the VAT
 *      share from margin. A plan that only clears its floor at 0% VAT is a plan
 *      that dies partway through its first good year.
 *
 * Nothing here is hard-coded to a particular plan. Costs are injected, so
 * retuning the business is a config change and the invariants re-verify.
 */

export interface BoxCostModel {
  /** Shipping box, tissue, sticker, inserts, the printed Cat ID card. */
  packagingSar: number;
  /** Last-mile per shipment. Boxes are heavy (a 10L litter bag is ~8kg). */
  deliverySar: number;
  /** Pick/pack labour and handling. */
  fulfilmentSar: number;
  /** Payment processing, as a fraction of gross (BNPL rails run high). */
  pspRate: number;
  /** Damage, spoilage and miscount, as a fraction of goods cost. */
  shrinkRate: number;
}

export interface BoxInvariants {
  /** Minimum discount vs à-la-carte the box must deliver (0.15 = 15% cheaper). */
  minMemberSaving: number;
  /** Minimum contribution margin, as a fraction of gross. */
  minContribution: number;
  /**
   * VAT rate to stress-test against, regardless of today's rate. Set to the
   * statutory rate so a plan is only approved if it survives registration.
   */
  stressVatRate: number;
}

export interface RecipeLine {
  sku: string;
  quantity: number;
  /** Supplier cost per unit. */
  unitCost: number;
  /** Our own à-la-carte shelf price per unit — the member's alternative. */
  unitRetail: number;
}

export interface BoxEconomics {
  /** What the same items would cost bought individually from our store. */
  retailValue: number;
  boxPrice: number;
  /** Absolute and relative saving vs à-la-carte. Negative means the box is a
   *  worse deal than the shelf — the condition invariant 1 forbids. */
  memberSavings: number;
  savingsPct: number;

  goodsCost: number;
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
  packagingSar: 10,
  deliverySar: 28,
  fulfilmentSar: 8,
  pspRate: 0.05,
  shrinkRate: 0.02,
};

export const DEFAULT_INVARIANTS: BoxInvariants = {
  minMemberSaving: 0.15,
  minContribution: 0.25,
  stressVatRate: 0.15,
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

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
  const goodsCost = round2(input.recipe.reduce((sum, l) => sum + l.unitCost * l.quantity, 0));

  const shrink = round2(goodsCost * cm.shrinkRate);
  const paymentFee = round2(input.boxPrice * cm.pspRate);
  const totalCost = round2(
    goodsCost + shrink + cm.packagingSar + cm.deliverySar + cm.fulfilmentSar + paymentFee
  );

  const contribution = round2(input.boxPrice - totalCost);
  const memberSavings = round2(retailValue - input.boxPrice);

  // Prices are VAT-inclusive, so registering removes the VAT share from
  // revenue rather than adding it to the customer's bill.
  const netRevenue = round2(input.boxPrice / (1 + stressVatRate));
  const vatDue = round2(input.boxPrice - netRevenue);
  const vatContribution = round2(contribution - vatDue);

  return {
    retailValue,
    boxPrice: round2(input.boxPrice),
    memberSavings,
    savingsPct: retailValue > 0 ? round2((memberSavings / retailValue) * 100) / 100 : 0,
    goodsCost,
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

export interface InvariantViolation {
  invariant: "MEMBER_VALUE" | "CONTRIBUTION" | "CONTRIBUTION_POST_VAT";
  message: string;
  actual: number;
  required: number;
}

/**
 * Check a plan against both invariants. Returns every violation rather than the
 * first, so a retune shows the whole picture instead of one error at a time.
 */
export function checkBoxInvariants(
  econ: BoxEconomics,
  inv: BoxInvariants = DEFAULT_INVARIANTS
): InvariantViolation[] {
  const out: InvariantViolation[] = [];

  if (econ.savingsPct < inv.minMemberSaving) {
    out.push({
      invariant: "MEMBER_VALUE",
      actual: econ.savingsPct,
      required: inv.minMemberSaving,
      message:
        econ.memberSavings < 0
          ? `Box costs ${Math.abs(econ.memberSavings)} SAR MORE than buying its contents à-la-carte (${econ.retailValue} SAR). A box priced above its own contents cannot be sold honestly.`
          : `Box saves only ${(econ.savingsPct * 100).toFixed(1)}% vs à-la-carte (${econ.retailValue} SAR); minimum is ${(inv.minMemberSaving * 100).toFixed(0)}%.`,
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

  if (econ.vatRegistered.contributionPct < inv.minContribution) {
    out.push({
      invariant: "CONTRIBUTION_POST_VAT",
      actual: econ.vatRegistered.contributionPct,
      required: inv.minContribution,
      message: `After VAT registration at ${(econ.vatRegistered.vatRate * 100).toFixed(0)}% contribution falls to ${(econ.vatRegistered.contributionPct * 100).toFixed(1)}% (${econ.vatRegistered.contribution} SAR). Registration is mandatory above SAR 375k rolling supplies — pricing must survive it.`,
    });
  }

  return out;
}

/**
 * Lowest price at which a recipe still clears the margin floor, including after
 * VAT registration. Use to price a new plan from its contents rather than
 * guessing a number and discovering the margin later.
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

  // price - fixed - price*psp - price*vatShare >= price*minContribution
  const vatShare = inv.stressVatRate / (1 + inv.stressVatRate);
  const denominator = 1 - costModel.pspRate - vatShare - inv.minContribution;
  if (denominator <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(fixed / denominator);
}
