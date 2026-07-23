/**
 * Catalog + official subscription plans seed (Pricing Model v2, MRC-FIN-002).
 *
 * SAFE to run against production: uses only upserts and scoped updates — it
 * never deletes referenced rows, never wipes users/subscriptions/content. It:
 *   1. Imports the supplier catalog (259 cat products) with MARKET-ALIGNED
 *      per-category markups (MRC-FIN-001 §3.3) + verified market benchmarks.
 *   2. Preps a default warehouse + zero-stock inventory for every product.
 *   3. Upserts the 4 official plans — Kitten 199 / Essentials 219 /
 *      Complete 329 / Signature 479 — with additive recipes, per-cat module
 *      pricing (multi-cat households), and the v2 economics gate.
 *   4. Deactivates legacy plans + old placeholder products (kept, not deleted,
 *      so existing subscriptions stay valid).
 *
 * Run:  pnpm --filter @moraqat/db seed:catalog
 */
import { PrismaClient, PlanTier, ProductType } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importCatalog } from "./import-catalog";
import { seedResearchedOptions } from "./seed-researched";
import {
  computeBoxEconomics,
  checkBoxInvariants,
  computeModuleEconomics,
  minimumViablePrice,
  DEFAULT_INVARIANTS,
  type BoxInvariants,
  type InvariantKind,
  type RecipeLine,
} from "@moraqat/core";
import { BOX_COST_MODEL } from "./box-cost-model";

const prisma = new PrismaClient();

/**
 * Store markup per supplier category — MARKET-ALIGNED (MRC-FIN-001 §3.3).
 *
 * The previous blanket 2.8× priced the store 60–100% above the real Saudi
 * market (verified five-store sweep, 2026-07-22): members price-check Petzone
 * and Amazon.sa, not our shelf, so an inflated shelf makes every "value" claim
 * fiction. These multiples land each category at or slightly under the market
 * benchmark, making the store genuinely shoppable and the box ledger honest.
 * Blended ≈ 1.7×. Env `CATALOG_MARKUP` overrides the fallback for unmapped
 * categories only — per-category values are a commercial decision recorded here.
 */
const CATEGORY_MARKUPS: Record<string, number> = {
  "Dry Food": 1.7,
  "Wet Food": 1.45,
  Litter: 1.9,
  Treats: 2.4,
  Supplements: 2.4,
  Grooming: 1.7,
  Accessories: 2.2,
  Beds: 2.2,
  Bowls: 2.2,
  Scratching: 2.2,
  Toys: 2.3,
  Travel: 2.2,
  Milk: 1.8,
};
const FALLBACK_MARKUP = Number(process.env.CATALOG_MARKUP ?? 2.0);

/**
 * KSA market benchmark prices per SKU (SAR) — the member's real alternative.
 * Source: MRC-FIN-001 five-store sweep (Amazon.sa, Zarafa, Petzone, Pet House,
 * My Cat), 2026-07-22/23. Values marked (est) had no exact listing and are
 * category-benchmark estimates; refresh quarterly with the sweep.
 */
const MARKET_PRICES: Record<string, number> = {
  P12500091: 80, // Josera Sensi 2kg — Amazon 84.86 / My Cat 75
  P12500047: 75, // Josera Kitten 2kg — Amazon 80.82 / Zarafa 69
  P12600201: 5.5, // Kit Cat Petite pouch — Petzone 5.50
  P12600203: 5.5, // Kit Cat Petite KITTEN pouch — same line
  P12600094: 6.0, // Kit Cat Kitten Mousse can (est from line pricing)
  P12600020: 39.95, // Kit Cat Classic Clump 10L — Petzone 39.95
  P12700002: 79.5, // LindoCat Advanced CPK 10L — Zarafa 79.50
  P12700003: 79.5, // LindoCat Advanced baby powder 10L — Zarafa
  P12700032: 55, // LindoCat The Original 10L — Zarafa 55
  P17700001: 7.75, // Wellness CORE Purely pouch — Zarafa 7.38 / Petzone 8.25
  P17900039: 6.5, // Acana can 85g — Petzone/My Cat 6.50
  P15901880: 18.95, // Zolux Sweeties 7-pk — Petzone 18.95
  P12600185: 18.95, // Kit Cat wipes 80ct — Petzone 18.95
  P10500016: 13, // Beaphar Calming Bits — Zarafa 13.00
  P15900663: 27, // Zolux plush toy (est)
  P15900666: 40, // Zolux XL toy (est)
  P12600262: 70, // Kit Cat Urinary supplement course (est)
};

/** Arabic units for box content lines (the Arabic checkout renders these). */
const UNIT_AR: Record<string, string> = {
  pouch: "كيس",
  can: "علبة",
  bag: "كيس",
  pack: "عبوة",
  kg: "كجم",
  each: "حبة",
  L: "لتر",
};

/** Box lines the member may customise by brand + flavor (consumables only). */
const CHOOSABLE: ReadonlySet<ProductType> = new Set<ProductType>([
  "WET_FOOD",
  "DRY_FOOD",
  "LITTER",
  "TREATS",
]);

interface ContentDef {
  sku: string;
  label: string;
  labelAr: string;
  qty: number;
  unit: string;
  /** false = shared per household (one per box regardless of cat count). */
  perCat?: boolean;
}

interface PlanDef {
  tier: PlanTier;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: number;
  /** Price of each ADDITIONAL cat (MRC-FIN-002 §5). Undefined = single-cat only. */
  modulePrice?: number;
  sortOrder: number;
  /** Per-plan delivery override (bigger boxes ship heavier). */
  deliverySar?: number;
  /** Per-plan invariant bands (MRC-FIN-002 §7.5). Merged over defaults. */
  invariants?: Partial<BoxInvariants>;
  /**
   * Floors this plan may ship in violation of, each with a recorded business
   * reason. Printed loudly at every seed — a waiver is a decision on the
   * record, never a silent bypass. Remove the waiver the day its reason dies.
   */
  acceptedViolations?: Partial<Record<InvariantKind, string>>;
  contents: ContentDef[];
}

/** Reason shared by the pre-negotiation waivers (MRC-FIN-002 §7.1). */
const PRE_NEGOTIATION =
  "Pre-negotiation COGS: clears the floor at the −10% supplier terms that are a " +
  "launch gate per MRC-FIN-002 §7.1 (fallback if talks fail: raise Complete to 349). " +
  "Re-seed and delete this waiver after the supplier agreement.";

/**
 * The 4 official plans (MRC-FIN-002 §3–4). Strictly additive: every tier
 * contains everything below it. Tier enum keys are stable internal ids; the
 * old STARTER/STANDARD/PREMIUM rows are renamed in place so existing
 * subscriptions and slugs keep working.
 */
const PLAN_DEFS: PlanDef[] = [
  {
    tier: "KITTEN" as PlanTier,
    slug: "kitten",
    nameEn: "Kitten",
    nameAr: "قطتي الصغيرة",
    descriptionEn:
      "Stage-aware nutrition for 3–8 months — kitten food, gentle litter, nothing she doesn't need yet.",
    descriptionAr: "تغذية مرحلية لعمر ٣–٨ أشهر — طعام صغار، رمل لطيف، ولا شيء لا تحتاجه بعد.",
    price: 199,
    modulePrice: 180,
    sortOrder: 0,
    invariants: { minMarketSaving: -0.05, minContributionPostVat: 0 },
    acceptedViolations: {
      CONTRIBUTION:
        "Acquisition tier by design (MRC-FIN-002 §4): a kitten owner is a 15-year " +
        "relationship; this plan reports to the CAC ledger, not the box P&L, and " +
        "auto-graduates to an adult plan at ~9 months.",
      CONTRIBUTION_POST_VAT:
        "Acquisition tier by design (MRC-FIN-002 §4) — see CONTRIBUTION waiver.",
    },
    contents: [
      { sku: "P12500047", label: "Kitten dry food 2kg", labelAr: "طعام جاف للصغار ٢كجم", qty: 1, unit: "bag" },
      { sku: "P12600203", label: "Kitten wet pouches", labelAr: "أكياس طعام رطب للصغار", qty: 10, unit: "pouch" },
      { sku: "P12600094", label: "Kitten mousse cans", labelAr: "علب موس للصغار", qty: 5, unit: "can" },
      { sku: "P12600020", label: "Clumping litter 10L", labelAr: "رمل متكتل ١٠ لتر", qty: 1, unit: "bag" },
    ],
  },
  {
    tier: "STARTER" as PlanTier,
    slug: "starter",
    nameEn: "Essentials",
    nameAr: "الأساسيات",
    descriptionEn:
      "Only the necessities — wet food, dry food, litter. Market price, delivered, never out of stock.",
    descriptionAr: "الضروريات فقط — طعام رطب وجاف ورمل. بسعر السوق، يصلك بابك، ولا ينفد أبداً.",
    price: 219,
    modulePrice: 180,
    sortOrder: 1,
    // Necessity tier: allowed up to 10% above the market basket (it sells
    // delivery + reliability) and therefore makes NO savings claim in copy.
    invariants: { minMarketSaving: -0.1 },
    acceptedViolations: { CONTRIBUTION_POST_VAT: PRE_NEGOTIATION },
    contents: [
      { sku: "P12500091", label: "Dry food 2kg", labelAr: "طعام جاف ٢كجم", qty: 1, unit: "bag" },
      { sku: "P12600201", label: "Wet food pouches", labelAr: "أكياس طعام رطب", qty: 15, unit: "pouch" },
      { sku: "P12600020", label: "Clumping litter 10L", labelAr: "رمل متكتل ١٠ لتر", qty: 1, unit: "bag" },
    ],
  },
  {
    tier: "STANDARD" as PlanTier,
    slug: "standard",
    nameEn: "Complete",
    nameAr: "العناية الكاملة",
    descriptionEn:
      "A true month of mixed feeding — 30 pouches + 2kg dry — plus litter, treats, play and care.",
    descriptionAr: "شهر كامل فعلاً من التغذية المختلطة — ٣٠ كيساً و٢كجم جاف — مع الرمل والمكافآت واللعب والعناية.",
    price: 329,
    modulePrice: 280,
    sortOrder: 2,
    deliverySar: 35,
    // Makes a savings claim in copy → must genuinely save vs the market basket.
    invariants: { minMarketSaving: 0.03 },
    acceptedViolations: {
      GROSS_MARGIN: PRE_NEGOTIATION,
      CONTRIBUTION_POST_VAT: PRE_NEGOTIATION,
    },
    contents: [
      { sku: "P12500091", label: "Dry food 2kg", labelAr: "طعام جاف ٢كجم", qty: 1, unit: "bag" },
      { sku: "P12600201", label: "Wet food pouches — a full month", labelAr: "أكياس طعام رطب — شهر كامل", qty: 30, unit: "pouch" },
      { sku: "P12600020", label: "Clumping litter 10L", labelAr: "رمل متكتل ١٠ لتر", qty: 1, unit: "bag" },
      { sku: "P15901880", label: "Creamy treats", labelAr: "مكافآت كريمية", qty: 1, unit: "pack" },
      { sku: "P15900663", label: "Play toy", labelAr: "لعبة", qty: 1, unit: "each" },
      { sku: "P12600185", label: "Grooming wet wipes", labelAr: "مناديل عناية مبلّلة", qty: 1, unit: "pack", perCat: false },
    ],
  },
  {
    tier: "PREMIUM" as PlanTier,
    slug: "premium",
    nameEn: "Signature",
    nameAr: "التوقيع",
    descriptionEn:
      "Complete, upgraded — premium wet rotation, advanced litter, a monthly supplement course and more.",
    descriptionAr: "العناية الكاملة، مرفوعة درجة — تشكيلة رطب فاخرة، رمل متقدم، كورس مكملات شهري والمزيد.",
    price: 479,
    modulePrice: 400,
    sortOrder: 3,
    deliverySar: 35,
    invariants: { minMarketSaving: 0.08 },
    acceptedViolations: {
      GROSS_MARGIN: PRE_NEGOTIATION,
      CONTRIBUTION_POST_VAT: PRE_NEGOTIATION,
    },
    contents: [
      { sku: "P12500091", label: "Dry food 2kg", labelAr: "طعام جاف ٢كجم", qty: 1, unit: "bag" },
      { sku: "P12600201", label: "Wet food pouches — a full month", labelAr: "أكياس طعام رطب — شهر كامل", qty: 30, unit: "pouch" },
      { sku: "P17700001", label: "Premium wet rotation", labelAr: "تشكيلة رطب فاخرة", qty: 9, unit: "pouch" },
      { sku: "P12700002", label: "Advanced clumping litter 10L", labelAr: "رمل متكتل متقدم ١٠ لتر", qty: 1, unit: "bag" },
      { sku: "P15901880", label: "Creamy treats", labelAr: "مكافآت كريمية", qty: 1, unit: "pack" },
      { sku: "P15900666", label: "Premium toy", labelAr: "لعبة فاخرة", qty: 1, unit: "each" },
      { sku: "P12600185", label: "Grooming wet wipes", labelAr: "مناديل عناية مبلّلة", qty: 1, unit: "pack", perCat: false },
      { sku: "P12600262", label: "Monthly supplement course", labelAr: "كورس مكملات شهري", qty: 1, unit: "pack", perCat: false },
    ],
  },
];

async function main() {
  console.log("▶ Importing supplier catalog (market-aligned category markups)…");
  const psv = readFileSync(join(__dirname, "..", "data", "supplier-catalog-2026-07.psv"), "utf-8");
  const res = await importCatalog(prisma, psv, {
    markupByCategory: CATEGORY_MARKUPS,
    markup: FALLBACK_MARKUP,
    marketPrices: MARKET_PRICES,
  });
  console.log(`  ✓ ${res.products} products, ${res.brands} brands, ${res.categories} categories`);
  if (res.skipped.length) console.log(`  ⚠ skipped ${res.skipped.length}:`, res.skipped.slice(0, 5));

  // ── Inventory prep: a default warehouse + zero-stock rows for every product ──
  const wh = await prisma.warehouse.upsert({
    where: { code: "MAIN" },
    update: {},
    create: { code: "MAIN", nameEn: "Main Warehouse", nameAr: "المستودع الرئيسي" },
  });
  const allProducts = await prisma.product.findMany({ select: { id: true, lowStockThreshold: true } });
  for (const p of allProducts) {
    await prisma.inventoryItem.upsert({
      where: { warehouseId_productId: { warehouseId: wh.id, productId: p.id } },
      update: {},
      create: { warehouseId: wh.id, productId: p.id, quantity: 0, reserved: 0, reorderLevel: 12 },
    });
  }
  console.log(`  ✓ inventory prepped for ${allProducts.length} products (warehouse MAIN, qty 0)`);

  // ── Official plans (MRC-FIN-002; VAT stressed at 15% regardless of VAT_RATE) ──
  const violationsFound: string[] = [];

  for (const def of PLAN_DEFS) {
    let cogs = 0;
    const recipe: RecipeLine[] = [];
    const perCatRecipe: RecipeLine[] = [];
    const contentRows: {
      label: string;
      labelAr: string;
      quantity: number;
      unit: string;
      unitAr: string;
      perCat: boolean;
      productId: string;
      selectableType: ProductType | null;
    }[] = [];
    for (const c of def.contents) {
      const prod = await prisma.product.findUnique({
        where: { sku: c.sku },
        select: { id: true, costPrice: true, price: true, marketPrice: true, type: true },
      });
      if (!prod) {
        console.warn(`  ⚠ box SKU ${c.sku} not found for plan ${def.nameEn} — skipped`);
        continue;
      }
      cogs += Number(prod.costPrice ?? 0) * c.qty;
      const line: RecipeLine = {
        sku: c.sku,
        quantity: c.qty,
        unitCost: Number(prod.costPrice ?? 0),
        // Our own shelf (in-app ledger)…
        unitRetail: Number(prod.price ?? 0),
        // …and the member's REAL alternative: the market benchmark.
        unitMarket: prod.marketPrice != null ? Number(prod.marketPrice) : undefined,
      };
      recipe.push(line);
      if (c.perCat !== false) perCatRecipe.push(line);
      contentRows.push({
        label: c.label,
        labelAr: c.labelAr,
        quantity: c.qty,
        unit: c.unit,
        unitAr: UNIT_AR[c.unit] ?? c.unit,
        perCat: c.perCat !== false,
        productId: prod.id,
        // Food/litter/treats lines are choosable (brand + flavor); the imported
        // product is the recommended default. Fixed lines (grooming) stay null.
        selectableType: CHOOSABLE.has(prod.type) ? prod.type : null,
      });
    }

    // ── Economics gate (v2) ─────────────────────────────────────────────────
    // Four floors: market value, gross margin, contribution, post-VAT
    // contribution. A floor may be waived ONLY by an explicit reasoned entry in
    // the plan def — printed at every seed so the debt stays visible.
    const costModel = { ...BOX_COST_MODEL, deliverySar: def.deliverySar ?? BOX_COST_MODEL.deliverySar };
    const inv: BoxInvariants = { ...DEFAULT_INVARIANTS, ...def.invariants };
    const econ = computeBoxEconomics({ recipe, boxPrice: def.price, costModel });
    const violations = checkBoxInvariants(econ, inv);
    const fatal = violations.filter((v) => !def.acceptedViolations?.[v.invariant]);
    const waived = violations.filter((v) => def.acceptedViolations?.[v.invariant]);
    for (const v of waived) {
      console.warn(
        `  ⚠ WAIVED [${v.invariant}] on ${def.nameEn}: ${(v.actual * 100).toFixed(1)}% vs floor ${(v.required * 100).toFixed(0)}%\n` +
          `     reason: ${def.acceptedViolations?.[v.invariant]}`
      );
    }
    if (fatal.length) {
      violationsFound.push(
        `${def.nameEn} (${def.price} SAR):\n` +
          fatal.map((v) => `      • [${v.invariant}] ${v.message}`).join("\n") +
          `\n      → minimum viable price for this recipe: ${minimumViablePrice(recipe, costModel, inv)} SAR`
      );
    }

    const planData = {
      slug: def.slug,
      nameEn: def.nameEn,
      nameAr: def.nameAr,
      descriptionEn: def.descriptionEn,
      descriptionAr: def.descriptionAr,
      basePrice: def.price,
      cogs: Math.round(cogs * 100) / 100,
      retailValue: econ.retailValue,
      marketValue: econ.marketValue,
      modulePriceSar: def.modulePrice ?? null,
      minTermMonths: 1,
      isActive: true,
      sortOrder: def.sortOrder,
    };
    const plan = await prisma.plan.upsert({
      where: { tier: def.tier },
      update: planData,
      create: { tier: def.tier, ...planData },
    });
    // Scoped to THIS plan only — safe.
    await prisma.planContent.deleteMany({ where: { planId: plan.id } });
    await prisma.planContent.createMany({
      data: contentRows.map((r) => ({ ...r, planId: plan.id })),
    });

    const mark = fatal.length ? "✗" : violations.length ? "⚠" : "✓";
    console.log(
      `  ${mark} ${def.nameEn}: ${def.price} SAR/mo · COGS ${cogs.toFixed(2)} · market ${econ.marketValue.toFixed(2)} ` +
        `(${econ.marketSavings >= 0 ? "saves" : "over by"} ${Math.abs(econ.marketSavingsPct * 100).toFixed(1)}%) ` +
        `· GM ${(econ.grossMarginPct * 100).toFixed(1)}% · CM ${(econ.contributionPct * 100).toFixed(1)}% → ${(econ.vatRegistered.contributionPct * 100).toFixed(1)}% post-VAT ` +
        `· ${contentRows.length} items`
    );

    // Multi-cat module: each additional cat must be profitable on its own.
    if (def.modulePrice) {
      const mod = computeModuleEconomics({
        perCatRecipe,
        modulePrice: def.modulePrice,
        costModel,
      });
      const modMark = mod.vatContribution >= 0 ? "✓" : "✗";
      console.log(
        `    ${modMark} +cat module ${def.modulePrice} SAR: goods ${mod.goodsCost.toFixed(2)} ` +
          `· CM ${(mod.contributionPct * 100).toFixed(1)}% → ${(mod.vatContributionPct * 100).toFixed(1)}% post-VAT`
      );
      if (mod.vatContribution < 0) {
        violationsFound.push(
          `${def.nameEn} +cat module (${def.modulePrice} SAR): post-VAT contribution is NEGATIVE ` +
            `(${mod.vatContribution.toFixed(2)} SAR) — every additional cat would lose money.`
        );
      }
    }
  }

  if (violationsFound.length) {
    console.error(
      `\n╔══════════════════════════════════════════════════════════════════╗\n` +
        `║  PLAN ECONOMICS INVARIANTS VIOLATED — refusing to seed           ║\n` +
        `╚══════════════════════════════════════════════════════════════════╝\n\n` +
        violationsFound.map((v) => `   ${v}`).join("\n\n") +
        `\n\n   These are business decisions, not bugs to code around. Resolve by\n` +
        `   adjusting plan price, recipe contents, catalogue markups\n` +
        `   (CATEGORY_MARKUPS), the cost model (BOX_DELIVERY_SAR et al) — or by\n` +
        `   recording an explicit reasoned waiver in the plan def. Set\n` +
        `   ALLOW_UNPROFITABLE_PLANS=1 to seed anyway (dev only).\n`
    );
    if (process.env.ALLOW_UNPROFITABLE_PLANS !== "1") {
      throw new Error(
        `${violationsFound.length} plan(s) violate the box economics invariants — see above.`
      );
    }
    console.warn("   ⚠ ALLOW_UNPROFITABLE_PLANS=1 — seeding anyway.\n");
  }

  // ── Deactivate legacy (kept, not deleted → existing subscriptions stay valid) ─
  const legacy = await prisma.plan.updateMany({
    where: { tier: { in: ["ESSENTIAL", "COMPLETE_CARE", "MULTI_CAT"] as PlanTier[] } },
    data: { isActive: false },
  });
  console.log(`  ✓ deactivated ${legacy.count} legacy plans`);

  const placeholders = await prisma.product.updateMany({
    where: { sku: { startsWith: "MRQ-" } },
    data: { isActive: false, isStorePublished: false },
  });
  console.log(`  ✓ deactivated ${placeholders.count} old placeholder products`);

  // Popular KSA brands/flavors as choosable box options (TO_SOURCE), alongside
  // the in-stock supplier catalog above.
  await seedResearchedOptions(prisma);

  console.log("✅ Catalog + plans seed complete (Pricing Model v2).");
}

main()
  .catch((e) => {
    console.error("❌ seed-catalog failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
