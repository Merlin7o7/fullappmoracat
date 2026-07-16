/**
 * Consumption-based plan recommendation.
 *
 * Instead of silently computing a plan from the cat's weight/age, we ASK the
 * owner what they actually go through each month (they know their cat best) and
 * recommend from that — with a plain "why this one". Nothing is preselected: the
 * member answers first, then sees a single honest recommendation they can still
 * change. Flat pricing means the tier is about *fit*, never an upsell (R006).
 */

import type { ApiPlan, PlanTier, BilingualReason } from "./plan-recommend";

/** The four questions, as tappable levels (effortless > free-typed numbers, R002). */
export type WetLevel = "none" | "few" | "regular" | "lots";
export type DryLevel = "none" | "one" | "two";
export type LitterLevel = "none" | "one" | "two";
export type TreatsLevel = "rarely" | "sometimes" | "often";

export interface ConsumptionAnswers {
  wet: WetLevel;
  dry: DryLevel;
  litter: LitterLevel;
  treats: TreatsLevel;
}

/** Representative monthly amounts each level stands for (used for the "why"). */
const WET_COUNT: Record<WetLevel, number> = { none: 0, few: 6, regular: 15, lots: 24 };
const DRY_KG: Record<DryLevel, number> = { none: 0, one: 2, two: 4 };
const LITTER_BAGS: Record<LitterLevel, number> = { none: 0, one: 1, two: 2 };
const TREATS_PACKS: Record<TreatsLevel, number> = { rarely: 0, sometimes: 1, often: 2 };

export interface ConsumptionRecommendation {
  tier: PlanTier;
  headline: BilingualReason;
  reasons: BilingualReason[];
}

/**
 * Map stated monthly consumption onto the three official boxes.
 *
 *  - Litter is the sharpest signal: the Starter box has NO litter, so anyone who
 *    goes through litter needs at least Standard.
 *  - Heavy wet-food eaters need the Premium box's larger pouch count.
 *  - Otherwise the Starter box is the honest, best-value fit.
 *
 * Every branch returns a plain explanation the member sees verbatim.
 */
export function recommendFromConsumption(a: ConsumptionAnswers): ConsumptionRecommendation {
  const wet = WET_COUNT[a.wet];
  const dry = DRY_KG[a.dry];
  const litterBags = LITTER_BAGS[a.litter];
  const treats = TREATS_PACKS[a.treats];
  const needsLitter = litterBags > 0;
  const heavyWet = a.wet === "lots";
  const heavyDry = a.dry === "two";

  const reasons: BilingualReason[] = [];
  let tier: PlanTier;
  let headline: BilingualReason;

  if (heavyWet || (needsLitter && heavyDry)) {
    tier = "PREMIUM";
    headline = { ar: "عناية فاخرة متكاملة", en: "Premium, complete care" };
    reasons.push(
      heavyWet
        ? {
            ar: `تستهلكون طعاماً رطباً بكثرة — الباقة المميّزة تجي بـ ٢٤ كيس شهرياً`,
            en: `You go through a lot of wet food — the Premium box brings 24 pouches a month`,
          }
        : {
            ar: `استهلاككم من الطعام والرمل عالٍ — الباقة المميّزة تغطيه كاملاً`,
            en: `Your food and litter use is high — the Premium box covers it all`,
          }
    );
    if (needsLitter) reasons.push({ ar: "ويشمل الرمل الفاخر — ما يحتاج تشتريه بره", en: "It includes premium litter too — nothing to buy separately" });
  } else if (needsLitter) {
    tier = "STANDARD";
    headline = { ar: "تغذية متوازنة كل يوم", en: "Balanced everyday care" };
    reasons.push({
      ar: `تستخدمون الرمل شهرياً — والباقة المبتدئة بدون رمل، فالقياسية هي المقاس الصحيح (طعام + رمل)`,
      en: `You use litter every month — the Starter box has none, so Standard is the right fit (food + litter)`,
    });
  } else {
    tier = "STARTER";
    headline = { ar: "أفضل قيمة — على مقاسكم تماماً", en: "Best value — sized exactly to you" };
    reasons.push({
      ar: "استهلاككم معتدل وبدون رمل — الباقة المبتدئة تغطيه تماماً، بلا زيادة",
      en: "Your use is light and litter-free — the Starter box covers it exactly, nothing wasted",
    });
  }

  // A concrete echo of what they told us (feels heard + transparent).
  const parts: { ar: string; en: string }[] = [];
  if (wet > 0) parts.push({ ar: `~${arNum(wet)} كيس رطب`, en: `~${wet} wet pouches` });
  if (dry > 0) parts.push({ ar: `~${arNum(dry)} كجم جاف`, en: `~${dry} kg dry` });
  if (litterBags > 0) parts.push({ ar: `${arNum(litterBags)} كيس رمل`, en: `${litterBags} litter bag${litterBags > 1 ? "s" : ""}` });
  if (parts.length) {
    reasons.push({
      ar: `حسب ما ذكرتم: ${parts.map((p) => p.ar).join("، ")} شهرياً`,
      en: `Based on what you told us: ${parts.map((p) => p.en).join(", ")} a month`,
    });
  }
  if (treats > 0) {
    reasons.push({
      ar: "وتحبون المكافآت — وكل الباقات تشمل مكافآت لذيذة",
      en: "And you like treats — every box includes tasty ones",
    });
  }

  return { tier, headline, reasons };
}

/** Does the recommended plan comfortably cover the stated wet-food volume? */
export function coversWet(plan: ApiPlan | undefined, a: ConsumptionAnswers): boolean {
  if (!plan) return true;
  const need = WET_COUNT[a.wet];
  const has = plan.contents
    .filter((c) => c.unit === "pouch" || c.unit === "can")
    .reduce((s, c) => s + c.quantity, 0);
  return has >= need;
}

const arNum = (n: number) => n.toLocaleString("ar-SA", { maximumFractionDigits: 1 });
