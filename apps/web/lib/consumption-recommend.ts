/**
 * Consumption-based plan recommendation (Pricing Model v2, MRC-FIN-002).
 *
 * Instead of silently computing a plan from the cat's weight/age, we ASK the
 * owner what they actually go through each month (they know their cat best) and
 * recommend from that — with a plain "why this one". Nothing is preselected: the
 * member answers first, then sees a single honest recommendation they can still
 * change. Flat pricing means the tier is about *fit*, never an upsell (R006).
 *
 * The four boxes are strictly additive (every tier contains everything below):
 *   KITTEN   "Kitten"     — stage-aware for cats under ~9 months (rule ONE).
 *   STARTER  "Essentials" — 2kg dry + 15 wet + 10L litter. Necessities only.
 *   STANDARD "Complete"   — a TRUE month of mixed feeding (30 wet) + treats,
 *                           toy & wipes.
 *   PREMIUM  "Signature"  — Complete + premium wet rotation (39 wet total),
 *                           upgraded litter & a supplement course.
 * Every box includes litter, so litter volume is no longer a tier signal —
 * wet-food volume and the care extras (treats) are.
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

/** The cat fields this recommender reads — PortalCat satisfies this structurally. */
export interface ConsumptionCat {
  birthDate?: string | null;
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

/** Age in whole months from an ISO birth date; undefined when unknown/invalid. */
function ageMonths(birthDate: string | null | undefined): number | undefined {
  if (!birthDate) return undefined;
  const b = new Date(birthDate);
  if (Number.isNaN(+b)) return undefined;
  const months = (Date.now() - b.getTime()) / (30.44 * 24 * 3600 * 1000);
  return months >= 0 ? Math.floor(months) : undefined;
}

/**
 * Map stated monthly consumption onto the four official boxes.
 *
 *  - KITTEN rule FIRST (MRC-FIN-002 §4): a household of cats all under ~9
 *    months gets the stage-aware Kitten box, whatever the answers say —
 *    kitten intake at 4–8 months actually exceeds a small adult's.
 *  - Heavy wet-food use (20+/mo) outgrows Essentials' 15 pouches → Complete.
 *  - Regular treats need Complete too — Essentials deliberately carries none.
 *  - Everything maxed (lots of wet + 4kg+ dry + treats often) is the full care
 *    ritual → Signature (39 pouches incl. premium rotation, supplements).
 *  - Otherwise Essentials is the honest fit: necessities, nothing padded.
 *  - Multi-cat households keep the SAME tier — one household subscription,
 *    each cat with their own module (§5) — never a forced top-tier upgrade.
 *
 * Every branch returns a plain explanation the member sees verbatim.
 */
export function recommendFromConsumption(
  a: ConsumptionAnswers,
  cats: ConsumptionCat[] = []
): ConsumptionRecommendation {
  const wet = WET_COUNT[a.wet];
  const dry = DRY_KG[a.dry];
  const litterBags = LITTER_BAGS[a.litter];
  const treats = TREATS_PACKS[a.treats];
  const heavyWet = a.wet === "lots";
  const heavyDry = a.dry === "two";
  const wantsTreats = treats > 0;

  const kittenAges = cats.map((c) => ageMonths(c.birthDate));
  const allKittens =
    cats.length > 0 && kittenAges.every((m) => m !== undefined && m < 9);

  const reasons: BilingualReason[] = [];
  let tier: PlanTier;
  let headline: BilingualReason;

  if (allKittens) {
    // Rule ONE: stage before volume.
    tier = "KITTEN";
    headline = { ar: "عناية مرحلية لقطك الصغير", en: "Stage-aware kitten care" };
    reasons.push({
      ar:
        cats.length === 1
          ? "عمره أقل من ٩ أشهر — باقة قطتي الصغيرة مبنية لمرحلته: طعام صغار، وتنتقل لخطة البالغين لما يكبر"
          : "كلهم أصغر من ٩ أشهر — باقة قطتي الصغيرة مبنية لمرحلتهم، وتنتقل لخطة البالغين لما يكبرون",
      en:
        cats.length === 1
          ? "Under 9 months old — the Kitten box is built for this stage: kitten food, graduating to an adult plan as they grow"
          : "All under 9 months old — the Kitten box is built for this stage, graduating to an adult plan as they grow",
    });
  } else if (heavyWet && heavyDry && a.treats === "often") {
    tier = "PREMIUM";
    headline = { ar: "التوقيع — طقس العناية الكامل", en: "Signature — the full care ritual" };
    reasons.push({
      ar: "استهلاككم عالي في كل شي — باقة التوقيع تجي بـ ٣٩ كيساً رطباً (منها تشكيلة فاخرة) مع المكافآت والمكملات",
      en: "Your use is high across the board — the Signature box brings 39 wet pouches (incl. a premium rotation) plus treats and supplements",
    });
  } else if (heavyWet || wantsTreats) {
    tier = "STANDARD";
    headline = { ar: "شهر كامل فعلاً من العناية", en: "A true month of care" };
    reasons.push(
      heavyWet
        ? {
            ar: "تستهلكون طعاماً رطباً بكثرة — العناية الكاملة تجي بـ ٣٠ كيساً: شهر حقيقي من التغذية المختلطة",
            en: "You go through a lot of wet food — Complete brings 30 pouches: a real month of mixed feeding",
          }
        : {
            ar: "تحبون المكافآت — باقة الأساسيات بدون مكافآت عمداً، والعناية الكاملة تشملها مع لعبة ومناديل عناية",
            en: "You like treats — Essentials deliberately has none, and Complete includes them with a toy and grooming wipes",
          }
    );
  } else {
    tier = "STARTER";
    headline = { ar: "الضروريات — على مقاسكم تماماً", en: "The necessities — sized exactly to you" };
    reasons.push({
      ar: "استهلاككم معتدل — باقة الأساسيات تغطيه تماماً: طعام ورمل، بلا حشو",
      en: "Your use is moderate — the Essentials box covers it exactly: food and litter, nothing padded",
    });
  }

  // Litter arrives in EVERY box — worth saying where the member uses it.
  if (litterBags > 0 && tier !== "KITTEN") {
    reasons.push({
      ar: "ويشمل رمل ١٠ لتر شهرياً — ما يحتاج تشتريه بره",
      en: "It includes 10L of litter each month — nothing to buy separately",
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

  // Multi-cat households: same tier, one household subscription (§5).
  if (cats.length >= 2) {
    reasons.push({
      ar: `عندكم ${arNum(cats.length)} قطط — اشتراك عائلي واحد يغطيهم كلهم: صندوق مشترك ولكل قط حصته الخاصة`,
      en: `You have ${cats.length} cats — one household subscription covers them all: a shared box with each cat's own share`,
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
