/**
 * Reusable supplier-catalog importer.
 *
 * Turns a pipe-delimited supplier export (see data/supplier-catalog-*.psv) into
 * Brand + Category + Product rows — idempotently (upsert by SKU), so re-running
 * it or importing a future catalog is a one-command operation. Designed for the
 * 2026-07 supplier import and every one after it.
 *
 * Rules honoured:
 *  - Never invents prices: rows without a real unit cost are skipped and reported.
 *  - The store is NOT public yet → every product is imported with
 *    isStorePublished=false. Flip that per-product (or in bulk) when the
 *    storefront launches.
 *  - Supplier screenshots are NOT customer images: we store only the filename
 *    reference (supplierImageRef) so official manufacturer images can replace it.
 *  - Retail price = cost × markup (config), rounded — prepared but not exposed.
 *
 * Usage:  importCatalog(prisma, psvText, { markup: 1.8 })
 */
import type { PrismaClient, ProductType } from "@prisma/client";

export interface ImportOptions {
  /** Retail markup multiple over supplier cost (default 1.8×). */
  markup?: number;
  /** Round retail up to end in this value, e.g. 0.9 → 44.9 (default: whole SAR). */
  priceEnding?: number;
}

export interface ImportResult {
  brands: number;
  categories: number;
  products: number;
  skipped: { img: string; reason: string }[];
}

/** Supplier category → (ProductType, subscription-eligible, store-only). */
const CATEGORY_MAP: Record<
  string,
  { type: ProductType; sub: boolean; storeOnly: boolean; ar: string }
> = {
  "Wet Food": { type: "WET_FOOD", sub: true, storeOnly: false, ar: "طعام رطب" },
  "Dry Food": { type: "DRY_FOOD", sub: true, storeOnly: false, ar: "طعام جاف" },
  Litter: { type: "LITTER", sub: true, storeOnly: false, ar: "رمل" },
  Treats: { type: "TREATS", sub: true, storeOnly: false, ar: "مكافآت" },
  Supplements: { type: "SUPPLEMENT", sub: true, storeOnly: false, ar: "مكمّل غذائي" },
  Milk: { type: "SUPPLEMENT", sub: true, storeOnly: false, ar: "حليب" },
  Grooming: { type: "GROOMING", sub: true, storeOnly: false, ar: "عناية" },
  Toys: { type: "TOY", sub: true, storeOnly: false, ar: "لعبة" },
  Scratching: { type: "SCRATCHING_POST", sub: false, storeOnly: true, ar: "مخالب وتسلّق" },
  Beds: { type: "BED", sub: false, storeOnly: true, ar: "سرير" },
  Bowls: { type: "BOWL", sub: false, storeOnly: true, ar: "وعاء" },
  Travel: { type: "CARRIER", sub: false, storeOnly: true, ar: "حقيبة سفر" },
  Accessories: { type: "ACCESSORY", sub: false, storeOnly: true, ar: "إكسسوار" },
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);

/** Parse "70g", "2kg", "10L", "200g" → grams where possible (litres left null). */
function parseWeightGrams(size: string): number | null {
  const m = size.match(/([\d.]+)\s*(kg|g)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1] as string);
  return (m[2] as string).toLowerCase() === "kg" ? Math.round(n * 1000) : Math.round(n);
}

function roundPrettyPrice(v: number, ending?: number): number {
  if (!ending) return Math.round(v);
  const whole = Math.floor(v);
  return whole + ending;
}

/** Common protein/flavor words → Arabic, so the box builder reads native (R103). */
const FLAVOR_AR_WORDS: [RegExp, string][] = [
  [/chicken/gi, "دجاج"], [/salmon/gi, "سلمون"], [/tuna/gi, "تونة"], [/beef/gi, "لحم بقري"],
  [/lamb/gi, "لحم ضأن"], [/duck/gi, "بط"], [/turkey/gi, "ديك رومي"], [/shrimp/gi, "روبيان"],
  [/sardine/gi, "سردين"], [/cheese/gi, "جبن"], [/liver/gi, "كبد"], [/seafood/gi, "مأكولات بحرية"],
  [/ocean/gi, "بحري"], [/fish/gi, "سمك"], [/kitten/gi, "هريرة"], [/senior/gi, "كبار السن"],
  [/sterilised|sterilized/gi, "معقّم"], [/adult/gi, "بالغ"], [/and|with/gi, "و"],
];

/** Turn a supplier VARIANT into a choosable flavor label, or null if generic. */
function flavorLabels(variant?: string): { en: string | null; ar: string | null } {
  const v = (variant ?? "").trim();
  if (!v || /^unknown$|^standard$|^regular$|^classic$/i.test(v)) return { en: null, ar: null };
  let ar = v;
  for (const [re, word] of FLAVOR_AR_WORDS) ar = ar.replace(re, word);
  // If no Arabic made it in, fall back to the English label rather than show junk.
  const hasArabic = /[؀-ۿ]/.test(ar);
  return { en: v, ar: hasArabic ? ar : v };
}

export async function importCatalog(
  prisma: PrismaClient,
  psv: string,
  opts: ImportOptions = {}
): Promise<ImportResult> {
  const markup = opts.markup ?? 1.8;
  const lines = psv.split(/\r?\n/).filter((l) => l.trim());
  const header = lines.shift(); // discard header row
  if (!header) return { brands: 0, categories: 0, products: 0, skipped: [] };

  const brandIds = new Map<string, string>();
  const categoryIds = new Map<string, string>();
  const skipped: { img: string; reason: string }[] = [];
  let productCount = 0;

  for (const line of lines) {
    const [img, category, brand, product, variant, size, cartonQtyS, unitCostS, cartonPriceS, sku] =
      line.split("|");
    if (!sku || sku === "Unknown") {
      skipped.push({ img: img ?? "?", reason: "no SKU" });
      continue;
    }
    const map = CATEGORY_MAP[category ?? ""] ?? {
      type: "OTHER" as ProductType,
      sub: false,
      storeOnly: true,
      ar: "أخرى",
    };

    // Cost: prefer unit cost; else derive from carton price / qty; else skip.
    let cost = Number(unitCostS);
    if (!Number.isFinite(cost) || cost <= 0) {
      const cp = Number(cartonPriceS);
      const q = Number(cartonQtyS) || 1;
      cost = Number.isFinite(cp) && cp > 0 ? cp / q : NaN;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      skipped.push({ img: img ?? "?", reason: "no readable cost" });
      continue;
    }

    // Brand upsert (idempotent by slug).
    let brandId: string | undefined;
    if (brand && brand !== "Unknown") {
      const bslug = slugify(brand);
      brandId = brandIds.get(bslug);
      if (!brandId) {
        const b = await prisma.brand.upsert({
          where: { slug: bslug },
          update: { nameEn: brand },
          create: { slug: bslug, nameEn: brand, nameAr: brand },
        });
        brandId = b.id;
        brandIds.set(bslug, brandId);
      }
    }

    // Category upsert.
    const cslug = slugify(category || "other");
    let categoryId = categoryIds.get(cslug);
    if (!categoryId) {
      const c = await prisma.category.upsert({
        where: { slug: cslug },
        update: {},
        create: { slug: cslug, nameEn: category || "Other", nameAr: map.ar },
      });
      categoryId = c.id;
      categoryIds.set(cslug, categoryId);
    }

    const nameEn = [product, variant && variant !== "Unknown" ? `— ${variant}` : ""]
      .filter(Boolean)
      .join(" ")
      .trim();
    // Placeholder Arabic name: "<category-ar> · <brand> <variant>". Flagged for a
    // native review pass (searchKeywords carries needs-ar so admin can filter).
    const nameAr = `${map.ar}${brand && brand !== "Unknown" ? ` · ${brand}` : ""}`;
    const retail = roundPrettyPrice(cost * markup, opts.priceEnding);
    const weightGrams = parseWeightGrams(size || "");
    const keywords = [product, variant, brand, category, map.ar, "needs-ar", sku]
      .filter((s) => s && s !== "Unknown")
      .join(" ")
      .toLowerCase();
    const flavor = flavorLabels(variant);

    const created = await prisma.product.upsert({
      where: { sku },
      update: {
        nameEn,
        price: retail,
        costPrice: cost,
        weightGrams: weightGrams ?? undefined,
        brandId,
        type: map.type,
        isSubscribable: map.sub,
        isStoreOnly: map.storeOnly,
        searchKeywords: keywords,
        supplierImageRef: img,
        flavorEn: flavor.en,
        flavorAr: flavor.ar,
        sourcing: "IN_STOCK", // imported supplier catalog = fulfilable today
      },
      create: {
        slug: `${slugify(`${brand}-${product}-${variant}`)}-${sku.slice(-4)}`.slice(0, 80),
        sku,
        type: map.type,
        brandId,
        nameEn,
        nameAr,
        price: retail,
        costPrice: cost,
        currency: "SAR",
        weightGrams: weightGrams ?? undefined,
        isActive: true,
        isSubscribable: map.sub,
        isStorePublished: false, // store not public yet (Decision 2)
        isStoreOnly: map.storeOnly,
        searchKeywords: keywords,
        supplierImageRef: img,
        flavorEn: flavor.en,
        flavorAr: flavor.ar,
        sourcing: "IN_STOCK",
      },
    });

    // Link to its category (idempotent).
    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: created.id, categoryId } },
      update: {},
      create: { productId: created.id, categoryId },
    });

    productCount++;
  }

  return {
    brands: brandIds.size,
    categories: categoryIds.size,
    products: productCount,
    skipped,
  };
}
