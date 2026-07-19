/**
 * Catalog + official subscription plans seed (2026-07 supplier import).
 *
 * SAFE to run against production: uses only upserts and scoped updates — it
 * never deletes referenced rows, never wipes users/subscriptions/content. It:
 *   1. Imports the supplier catalog (259 cat products) via the reusable importer.
 *   2. Preps a default warehouse + zero-stock inventory for every product.
 *   3. Upserts the 3 official plans (Starter/Standard/Premium) with real box
 *      recipes + COGS computed from real supplier costs. 0% VAT (not registered).
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
  minimumViablePrice,
  type RecipeLine,
} from "@moraqat/core";
import { BOX_COST_MODEL } from "./box-cost-model";

const prisma = new PrismaClient();

/**
 * Catalogue markup over supplier cost — the à-la-carte price a member pays if
 * they buy the box contents individually. It therefore decides whether the
 * subscription is a genuine saving or a penalty.
 *
 * Raised from 1.8× to 2.8×. At 1.8× the store undercut its own subscription:
 * Starter cost 35% MORE than buying its three items off the shelf, so the box
 * had no value story and any price-checking member would churn at term end.
 * 2.8× is ordinary pet-specialty retail (keystone-plus) and makes all three
 * plans clear both invariants WITHOUT changing a single customer-facing plan
 * price — 249/349/529 are unchanged, they are simply now a real discount.
 *
 * Env-overridable because it is a commercial decision, not a constant.
 */
const CATALOG_MARKUP = Number(process.env.CATALOG_MARKUP ?? 2.8);

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

/** The 3 official boxes — recipes reference real supplier SKUs (financial model). */
const PLAN_DEFS = [
  {
    tier: "STARTER" as PlanTier,
    slug: "starter",
    nameEn: "Starter",
    nameAr: "المبتدئة",
    descriptionEn: "Everyday food for one cat — light box, no litter.",
    descriptionAr: "تغذية يومية لقط واحد — صندوق خفيف بدون رمل.",
    price: 249,
    sortOrder: 0,
    contents: [
      { sku: "P12600201", label: "Wet food pouches", labelAr: "أكياس طعام رطب", qty: 15, unit: "pouch" },
      { sku: "P12500091", label: "Dry food 2kg", labelAr: "طعام جاف ٢كجم", qty: 1, unit: "bag" },
      { sku: "P15901880", label: "Creamy treats", labelAr: "مكافآت كريمية", qty: 1, unit: "pack" },
    ],
  },
  {
    tier: "STANDARD" as PlanTier,
    slug: "standard",
    nameEn: "Standard",
    nameAr: "القياسية",
    descriptionEn: "Food + litter for one cat — everything handled monthly.",
    descriptionAr: "طعام ورمل لقط واحد — كل شيء يُدار شهرياً.",
    price: 349,
    sortOrder: 1,
    contents: [
      { sku: "P17900039", label: "Premium wet cans", labelAr: "معلبات رطبة فاخرة", qty: 15, unit: "can" },
      { sku: "P12500091", label: "Dry food 2kg", labelAr: "طعام جاف ٢كجم", qty: 1, unit: "bag" },
      { sku: "P12700032", label: "Clumping litter 10L", labelAr: "رمل متكتل ١٠ لتر", qty: 1, unit: "bag" },
      { sku: "P10500016", label: "Calming treats", labelAr: "مكافآت مهدّئة", qty: 1, unit: "pack" },
    ],
  },
  {
    tier: "PREMIUM" as PlanTier,
    slug: "premium",
    nameEn: "Premium",
    nameAr: "المميّزة",
    descriptionEn: "Premium food, litter, grooming + treats — the full care box.",
    descriptionAr: "طعام فاخر ورمل وعناية ومكافآت — صندوق العناية الكامل.",
    price: 529,
    sortOrder: 2,
    contents: [
      { sku: "P17700001", label: "Premium wet pouches", labelAr: "أكياس رطبة فاخرة", qty: 24, unit: "pouch" },
      // Reconciled to a real 2kg dry (P12500071 Naturelle is a 10kg bag @204 —
      // no 2kg premium dry exists in this catalog). Premium is differentiated by
      // its 24 premium pouches + premium litter + grooming, not the dry bag.
      { sku: "P12500091", label: "Dry food 2kg", labelAr: "طعام جاف ٢كجم", qty: 1, unit: "bag" },
      { sku: "P12700003", label: "Premium litter 10L", labelAr: "رمل فاخر ١٠ لتر", qty: 1, unit: "bag" },
      { sku: "P12600185", label: "Grooming wet wipes", labelAr: "مناديل عناية مبلّلة", qty: 1, unit: "pack" },
      { sku: "P15901880", label: "Creamy treats", labelAr: "مكافآت كريمية", qty: 1, unit: "pack" },
    ],
  },
];

async function main() {
  console.log("▶ Importing supplier catalog…");
  const psv = readFileSync(join(__dirname, "..", "data", "supplier-catalog-2026-07.psv"), "utf-8");
  const res = await importCatalog(prisma, psv, { markup: CATALOG_MARKUP });
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

  // ── Official plans (0% VAT; COGS from real supplier costs) ──────────────────
  const violationsFound: string[] = [];

  for (const def of PLAN_DEFS) {
    let cogs = 0;
    const recipe: RecipeLine[] = [];
    const contentRows: {
      label: string;
      labelAr: string;
      quantity: number;
      unit: string;
      unitAr: string;
      productId: string;
      selectableType: ProductType | null;
    }[] = [];
    for (const c of def.contents) {
      const prod = await prisma.product.findUnique({
        where: { sku: c.sku },
        select: { id: true, costPrice: true, price: true, type: true },
      });
      if (!prod) {
        console.warn(`  ⚠ box SKU ${c.sku} not found for plan ${def.nameEn} — skipped`);
        continue;
      }
      cogs += Number(prod.costPrice ?? 0) * c.qty;
      recipe.push({
        sku: c.sku,
        quantity: c.qty,
        unitCost: Number(prod.costPrice ?? 0),
        // The member's actual alternative: our own shelf price.
        unitRetail: Number(prod.price ?? 0),
      });
      contentRows.push({
        label: c.label,
        labelAr: c.labelAr,
        quantity: c.qty,
        unit: c.unit,
        unitAr: UNIT_AR[c.unit] ?? c.unit,
        productId: prod.id,
        // Food/litter/treats lines are choosable (brand + flavor); the imported
        // product is the recommended default. Fixed lines (grooming) stay null.
        selectableType: CHOOSABLE.has(prod.type) ? prod.type : null,
      });
    }

    // ── Invariant gate ──────────────────────────────────────────────────────
    // A plan that costs more than its own contents, or that cannot survive VAT
    // registration, must never reach a customer. Reported for every plan first,
    // then failed at the end so one run shows the whole picture.
    const econ = computeBoxEconomics({ recipe, boxPrice: def.price, costModel: BOX_COST_MODEL });
    const violations = checkBoxInvariants(econ);
    if (violations.length) {
      violationsFound.push(
        `${def.nameEn} (${def.price} SAR):\n` +
          violations.map((v) => `      • [${v.invariant}] ${v.message}`).join("\n") +
          `\n      → minimum viable price for this recipe: ${minimumViablePrice(recipe, BOX_COST_MODEL)} SAR`
      );
    }

    const plan = await prisma.plan.upsert({
      where: { tier: def.tier },
      update: {
        slug: def.slug,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        descriptionEn: def.descriptionEn,
        descriptionAr: def.descriptionAr,
        basePrice: def.price,
        cogs: Math.round(cogs * 100) / 100,
        retailValue: econ.retailValue,
        minTermMonths: 1,
        isActive: true,
        sortOrder: def.sortOrder,
      },
      create: {
        tier: def.tier,
        slug: def.slug,
        nameEn: def.nameEn,
        nameAr: def.nameAr,
        descriptionEn: def.descriptionEn,
        descriptionAr: def.descriptionAr,
        basePrice: def.price,
        cogs: Math.round(cogs * 100) / 100,
        retailValue: econ.retailValue,
        minTermMonths: 1,
        isActive: true,
        sortOrder: def.sortOrder,
      },
    });
    // Scoped to THIS plan only — safe.
    await prisma.planContent.deleteMany({ where: { planId: plan.id } });
    await prisma.planContent.createMany({
      data: contentRows.map((r) => ({ ...r, planId: plan.id })),
    });
    // Honest margin: the previous print was (price − cogs)/price, which ignored
    // packaging, delivery, fulfilment, PSP fees and shrink — overstating margin
    // by roughly 20 points to anyone reading the seed output.
    const mark = violations.length ? "✗" : "✓";
    console.log(
      `  ${mark} ${def.nameEn}: ${def.price} SAR/mo · COGS ${cogs.toFixed(2)} · retail ${econ.retailValue.toFixed(2)} ` +
        `· member saves ${econ.memberSavings.toFixed(2)} (${(econ.savingsPct * 100).toFixed(1)}%) ` +
        `· CM ${(econ.contributionPct * 100).toFixed(1)}% → ${(econ.vatRegistered.contributionPct * 100).toFixed(1)}% post-VAT ` +
        `· ${contentRows.length} items`
    );
  }

  if (violationsFound.length) {
    console.error(
      `\n╔══════════════════════════════════════════════════════════════════╗\n` +
        `║  PLAN ECONOMICS INVARIANTS VIOLATED — refusing to seed           ║\n` +
        `╚══════════════════════════════════════════════════════════════════╝\n\n` +
        violationsFound.map((v) => `   ${v}`).join("\n\n") +
        `\n\n   These are business decisions, not bugs to code around. Resolve by\n` +
        `   adjusting plan price, recipe contents, catalogue markup\n` +
        `   (CATALOG_MARKUP), or the cost model (BOX_DELIVERY_SAR et al) — then\n` +
        `   re-run. Set ALLOW_UNPROFITABLE_PLANS=1 to seed anyway (dev only).\n`
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

  console.log("✅ Catalog + plans seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ seed-catalog failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
