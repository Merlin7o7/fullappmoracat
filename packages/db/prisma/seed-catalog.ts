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
import { PrismaClient, PlanTier } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importCatalog } from "./import-catalog";

const prisma = new PrismaClient();

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
  const res = await importCatalog(prisma, psv, { markup: 1.8 });
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
  for (const def of PLAN_DEFS) {
    let cogs = 0;
    const contentRows: { label: string; quantity: number; unit: string; productId: string }[] = [];
    for (const c of def.contents) {
      const prod = await prisma.product.findUnique({
        where: { sku: c.sku },
        select: { id: true, costPrice: true },
      });
      if (!prod) {
        console.warn(`  ⚠ box SKU ${c.sku} not found for plan ${def.nameEn} — skipped`);
        continue;
      }
      cogs += Number(prod.costPrice ?? 0) * c.qty;
      contentRows.push({ label: c.label, quantity: c.qty, unit: c.unit, productId: prod.id });
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
        minTermMonths: 3,
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
        minTermMonths: 3,
        isActive: true,
        sortOrder: def.sortOrder,
      },
    });
    // Scoped to THIS plan only — safe.
    await prisma.planContent.deleteMany({ where: { planId: plan.id } });
    await prisma.planContent.createMany({
      data: contentRows.map((r) => ({ ...r, planId: plan.id })),
    });
    console.log(
      `  ✓ ${def.nameEn}: ${def.price} SAR/mo · COGS ${cogs.toFixed(2)} · margin ${(((def.price - cogs) / def.price) * 100).toFixed(0)}% · ${contentRows.length} items`
    );
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

  console.log("✅ Catalog + plans seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ seed-catalog failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
