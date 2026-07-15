/**
 * Popular KSA cat brands/flavors as box-builder options, imported as TO_SOURCE.
 *
 * The supplier sheet (data/supplier-catalog-*.psv) is what we can ship TODAY
 * (IN_STOCK). These are the brands Saudi owners expect to see — Whiskas, Royal
 * Canin, Sheba, Friskies, Felix, Fancy Feast, Ever Clean… — sourced from what
 * KSA pet e-commerce actually sells (noon, Petzone, Bayt Al Aleefa, Petaholic).
 * They're advertised as choosable but flagged TO_SOURCE so we never imply
 * something is in the box before we've procured it (honest by default, R006).
 *
 * Flat pricing: `price` here is nominal/reference only — the plan price is what
 * the member pays regardless of the brand/flavor they pick.
 *
 * SAFE for production: upsert-only, keyed by a stable synthetic SKU (TS-…).
 */
import type { PrismaClient, ProductType } from "@prisma/client";

interface OptionGroup {
  type: ProductType;
  brand: string;
  brandAr: string;
  /** [flavorEn, flavorAr] pairs — each becomes one choosable product. */
  flavors: [string, string][];
}

export const RESEARCHED_OPTIONS: OptionGroup[] = [
  // ── Wet food ────────────────────────────────────────────────────────────
  { type: "WET_FOOD", brand: "Whiskas", brandAr: "ويسكاس",
    flavors: [["Tuna", "تونة"], ["Chicken", "دجاج"], ["Mackerel", "ماكريل"], ["Salmon", "سلمون"]] },
  { type: "WET_FOOD", brand: "Sheba", brandAr: "شيبا",
    flavors: [["Tuna", "تونة"], ["Chicken Breast", "صدر دجاج"], ["Salmon", "سلمون"]] },
  { type: "WET_FOOD", brand: "Friskies", brandAr: "فريسكيز",
    flavors: [["Chicken", "دجاج"], ["Salmon", "سلمون"], ["Ocean Fish", "سمك بحري"], ["Turkey", "ديك رومي"]] },
  { type: "WET_FOOD", brand: "Felix", brandAr: "فيليكس",
    flavors: [["Chicken", "دجاج"], ["Tuna", "تونة"], ["Beef", "لحم بقري"], ["Salmon", "سلمون"]] },
  { type: "WET_FOOD", brand: "Fancy Feast", brandAr: "فانسي فيست",
    flavors: [["Chicken", "دجاج"], ["Tuna", "تونة"], ["Salmon", "سلمون"]] },
  // ── Dry food ────────────────────────────────────────────────────────────
  { type: "DRY_FOOD", brand: "Royal Canin", brandAr: "رويال كانين",
    flavors: [["Indoor Adult", "داخلي بالغ"], ["Kitten", "هريرة"], ["Hair & Skin", "الشعر والبشرة"]] },
  { type: "DRY_FOOD", brand: "Whiskas", brandAr: "ويسكاس",
    flavors: [["Chicken", "دجاج"], ["Tuna", "تونة"]] },
  { type: "DRY_FOOD", brand: "Meow Mix", brandAr: "ميو ميكس",
    flavors: [["Original Choice", "الخيار الأصلي"], ["Salmon", "سلمون"]] },
  { type: "DRY_FOOD", brand: "Friskies", brandAr: "فريسكيز",
    flavors: [["Surfin' & Turfin'", "بحري وبرّي"], ["Chicken", "دجاج"]] },
  // ── Litter ──────────────────────────────────────────────────────────────
  { type: "LITTER", brand: "Ever Clean", brandAr: "إيفر كلين",
    flavors: [["Unscented", "بدون رائحة"], ["Fresh Scent", "رائحة منعشة"]] },
  { type: "LITTER", brand: "Cat's Best", brandAr: "كاتس بست",
    flavors: [["Original", "الأصلي"]] },
  { type: "LITTER", brand: "Tidy Cats", brandAr: "تايدي كاتس",
    flavors: [["Clumping", "متكتّل"]] },
  { type: "LITTER", brand: "Biokat's", brandAr: "بيوكاتس",
    flavors: [["Classic Clumping", "كلاسيكي متكتّل"]] },
  // ── Treats ──────────────────────────────────────────────────────────────
  { type: "TREATS", brand: "Temptations", brandAr: "تمبتيشنز",
    flavors: [["Chicken", "دجاج"], ["Tuna", "تونة"], ["Salmon", "سلمون"]] },
  { type: "TREATS", brand: "Sheba", brandAr: "شيبا",
    flavors: [["Creamy Chicken", "كريمة دجاج"], ["Creamy Tuna", "كريمة تونة"]] },
];

/** Nominal reference price by type (member pays the flat plan price regardless). */
const REF_PRICE: Partial<Record<ProductType, number>> = {
  WET_FOOD: 5,
  DRY_FOOD: 60,
  LITTER: 45,
  TREATS: 18,
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

/**
 * Upsert the researched brand/flavor options as TO_SOURCE products so the box
 * builder always has a rich, familiar choice — even on the minimal dev seed.
 */
export async function seedResearchedOptions(prisma: PrismaClient): Promise<number> {
  let n = 0;
  for (const group of RESEARCHED_OPTIONS) {
    const bslug = slugify(group.brand);
    const brand = await prisma.brand.upsert({
      where: { slug: bslug },
      update: { nameAr: group.brandAr },
      create: { slug: bslug, nameEn: group.brand, nameAr: group.brandAr },
    });
    for (const [flavorEn, flavorAr] of group.flavors) {
      const sku = `TS-${slugify(`${group.type}-${group.brand}-${flavorEn}`)}`.toUpperCase().slice(0, 60);
      await prisma.product.upsert({
        where: { sku },
        update: {
          type: group.type,
          brandId: brand.id,
          flavorEn,
          flavorAr,
          sourcing: "TO_SOURCE",
          isSubscribable: true,
          isActive: true,
        },
        create: {
          slug: slugify(`${group.brand}-${flavorEn}-${group.type}`).slice(0, 80),
          sku,
          type: group.type,
          brandId: brand.id,
          nameEn: `${group.brand} — ${flavorEn}`,
          nameAr: `${group.brandAr} — ${flavorAr}`,
          price: REF_PRICE[group.type] ?? 20,
          currency: "SAR",
          isActive: true,
          isSubscribable: true,
          isStorePublished: false,
          flavorEn,
          flavorAr,
          sourcing: "TO_SOURCE",
        },
      });
      n++;
    }
  }
  console.log(`  ✓ researched box options (to-source): ${n}`);
  return n;
}
