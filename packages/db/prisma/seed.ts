/**
 * Seed data for Moraqat.
 * Plans, prices, COGS and plan contents are taken directly from
 * Moraqat_Financial_Model.xlsx (Assumptions + Unit Economics tabs).
 */
import { PrismaClient, PlanTier, ProductType, StaffScope } from "@prisma/client";
import { hash } from "bcryptjs";
import { seedResearchedOptions } from "./seed-researched";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Moraqat…");

  // ── Cities (launch markets) ────────────────────────────────────────────
  const [jeddah, riyadh] = await Promise.all([
    prisma.city.upsert({
      where: { slug: "jeddah" },
      update: {},
      create: { slug: "jeddah", nameEn: "Jeddah", nameAr: "جدة" },
    }),
    prisma.city.upsert({
      where: { slug: "riyadh" },
      update: {},
      create: { slug: "riyadh", nameEn: "Riyadh", nameAr: "الرياض" },
    }),
  ]);
  console.log(`  ✓ cities: ${jeddah.nameEn}, ${riyadh.nameEn}`);

  // ── Breeds (with calorie references for the feeding engine) ────────────
  const breeds = [
    { nameEn: "Domestic Shorthair", nameAr: "قط منزلي قصير الشعر", avgWeightKg: 4.5, caloriePerKg: 60 },
    { nameEn: "Persian", nameAr: "شيرازي", avgWeightKg: 5.0, caloriePerKg: 55 },
    { nameEn: "Maine Coon", nameAr: "مين كون", avgWeightKg: 7.0, caloriePerKg: 65 },
    { nameEn: "Siamese", nameAr: "سيامي", avgWeightKg: 4.0, caloriePerKg: 70 },
    { nameEn: "British Shorthair", nameAr: "بريطاني قصير الشعر", avgWeightKg: 5.5, caloriePerKg: 55 },
    { nameEn: "Arabian Mau", nameAr: "الماو العربي", avgWeightKg: 4.5, caloriePerKg: 65 },
  ];
  for (const b of breeds) {
    await prisma.breed.upsert({ where: { nameEn: b.nameEn }, update: {}, create: b });
  }
  console.log(`  ✓ breeds: ${breeds.length}`);

  // ── Brands ─────────────────────────────────────────────────────────────
  const brandData = [
    { slug: "royal-canin", nameEn: "Royal Canin", nameAr: "رويال كانين", isFeatured: true },
    { slug: "whiskas", nameEn: "Whiskas", nameAr: "ويسكاس" },
    { slug: "sheba", nameEn: "Sheba", nameAr: "شيبا", isFeatured: true },
    { slug: "moraqat-care", nameEn: "Moraqat Care", nameAr: "مرقط كير", isFeatured: true },
  ];
  const brands: Record<string, string> = {};
  for (const b of brandData) {
    const brand = await prisma.brand.upsert({ where: { slug: b.slug }, update: {}, create: b });
    brands[b.slug] = brand.id;
  }
  console.log(`  ✓ brands: ${brandData.length}`);

  // ── Products (unit costs from Assumptions tab, retail prices est.) ──────
  const productData = [
    { slug: "dry-food-premium-2kg", sku: "MRQ-DRY-PRM-2", type: ProductType.DRY_FOOD, nameEn: "Premium Dry Food 2kg", nameAr: "طعام جاف فاخر ٢كجم", price: 79, costPrice: 54, brand: "royal-canin" },
    { slug: "dry-food-mass-2kg", sku: "MRQ-DRY-MSS-2", type: ProductType.DRY_FOOD, nameEn: "Everyday Dry Food 2kg", nameAr: "طعام جاف يومي ٢كجم", price: 49, costPrice: 36, brand: "whiskas" },
    { slug: "wet-pouch-premium-85g", sku: "MRQ-WET-PRM-85", type: ProductType.WET_FOOD, nameEn: "Premium Wet Pouch 85g", nameAr: "كيس رطب فاخر ٨٥جم", price: 6, costPrice: 3, brand: "sheba" },
    { slug: "wet-pouch-mass-85g", sku: "MRQ-WET-MSS-85", type: ProductType.WET_FOOD, nameEn: "Everyday Wet Pouch 85g", nameAr: "كيس رطب يومي ٨٥جم", price: 4, costPrice: 2.2, brand: "whiskas" },
    { slug: "clumping-litter-10kg", sku: "MRQ-LIT-CLM-10", type: ProductType.LITTER, nameEn: "Clumping Litter 10kg", nameAr: "رمل متكتل ١٠كجم", price: 45, costPrice: 26, brand: "moraqat-care" },
    { slug: "cat-treats-pack", sku: "MRQ-TRT-PCK", type: ProductType.TREATS, nameEn: "Cat Treats Pack", nameAr: "علبة مكافآت", price: 18, costPrice: 9, brand: "sheba" },
    { slug: "dental-care-item", sku: "MRQ-HLT-DNT", type: ProductType.HEALTHCARE, nameEn: "Dental Care Stick", nameAr: "عناية بالأسنان", price: 22, costPrice: 12, brand: "moraqat-care" },
    { slug: "monthly-supplement", sku: "MRQ-SUP-MTH", type: ProductType.SUPPLEMENT, nameEn: "Monthly Supplement", nameAr: "مكمل شهري", price: 29, costPrice: 15, brand: "moraqat-care" },
    { slug: "enrichment-toy", sku: "MRQ-TOY-ENR", type: ProductType.TOY, nameEn: "Enrichment Toy", nameAr: "لعبة تفاعلية", price: 15, costPrice: 7, brand: "moraqat-care" },
  ];
  const products: Record<string, string> = {};
  for (const p of productData) {
    const created = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        slug: p.slug,
        sku: p.sku,
        type: p.type,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        price: p.price,
        costPrice: p.costPrice,
        brandId: brands[p.brand],
        ratingAvg: 4.6,
        ratingCount: 24,
      },
    });
    products[p.slug] = created.id;
  }
  console.log(`  ✓ products: ${productData.length}`);

  // ── Official plans (2026-07): Starter / Standard / Premium ──────────────
  // Prices/COGS from the financial model at 0% VAT. `pnpm db:seed:catalog`
  // rebuilds these from the REAL supplier catalog; this dev seed mirrors them
  // using placeholder products so a bare `db:seed` is self-consistent.
  const plans = [
    {
      tier: PlanTier.STARTER, slug: "starter", nameEn: "Starter", nameAr: "المبتدئة",
      basePrice: 249, cogs: 104.75,
      contents: [
        { label: "Wet food pouches", quantity: 15, unit: "pouch", product: "wet-pouch-mass-85g", sel: ProductType.WET_FOOD },
        { label: "Dry food 2kg", quantity: 1, unit: "bag", product: "dry-food-mass-2kg", sel: ProductType.DRY_FOOD },
        { label: "Creamy treats", quantity: 1, unit: "pack", product: "cat-treats-pack", sel: ProductType.TREATS },
      ],
    },
    {
      tier: PlanTier.STANDARD, slug: "standard", nameEn: "Standard", nameAr: "القياسية",
      basePrice: 349, cogs: 150.75,
      contents: [
        { label: "Premium wet cans", quantity: 15, unit: "can", product: "wet-pouch-premium-85g", sel: ProductType.WET_FOOD },
        { label: "Dry food 2kg", quantity: 1, unit: "bag", product: "dry-food-mass-2kg", sel: ProductType.DRY_FOOD },
        { label: "Clumping litter 10L", quantity: 1, unit: "bag", product: "clumping-litter-10kg", sel: ProductType.LITTER },
        { label: "Calming treats", quantity: 1, unit: "pack", product: "cat-treats-pack", sel: ProductType.TREATS },
      ],
    },
    {
      tier: PlanTier.PREMIUM, slug: "premium", nameEn: "Premium", nameAr: "المميّزة",
      basePrice: 529, cogs: 245.25,
      contents: [
        { label: "Premium wet pouches", quantity: 24, unit: "pouch", product: "wet-pouch-premium-85g", sel: ProductType.WET_FOOD },
        { label: "Dry food 2kg", quantity: 1, unit: "bag", product: "dry-food-premium-2kg", sel: ProductType.DRY_FOOD },
        { label: "Premium litter 10L", quantity: 1, unit: "bag", product: "clumping-litter-10kg", sel: ProductType.LITTER },
        { label: "Grooming wipes", quantity: 1, unit: "pack", product: "monthly-supplement" },
        { label: "Creamy treats", quantity: 1, unit: "pack", product: "cat-treats-pack", sel: ProductType.TREATS },
      ],
    },
  ];

  for (const [i, p] of plans.entries()) {
    const plan = await prisma.plan.upsert({
      where: { tier: p.tier },
      update: { basePrice: p.basePrice, cogs: p.cogs, minTermMonths: 1, isActive: true, sortOrder: i },
      create: {
        tier: p.tier, slug: p.slug, nameEn: p.nameEn, nameAr: p.nameAr,
        basePrice: p.basePrice, cogs: p.cogs, sortOrder: i, minTermMonths: 1,
      },
    });
    await prisma.planContent.deleteMany({ where: { planId: plan.id } });
    await prisma.planContent.createMany({
      data: p.contents.map((c) => ({
        planId: plan.id, label: c.label, quantity: c.quantity, unit: c.unit,
        productId: products[c.product],
        selectableType: "sel" in c ? c.sel : null,
      })),
    });
  }
  // Legacy tiers stay in the enum for old rows but are never active/offered.
  await prisma.plan.updateMany({
    where: { tier: { in: [PlanTier.ESSENTIAL, PlanTier.COMPLETE_CARE, PlanTier.MULTI_CAT] } },
    data: { isActive: false },
  });
  console.log(`  ✓ plans: ${plans.length} official (Starter/Standard/Premium), legacy deactivated`);

  // Popular KSA brands/flavors as choosable box options (TO_SOURCE) so the box
  // builder is rich even on the minimal dev seed.
  await seedResearchedOptions(prisma);

  // ── RBAC: system roles + core permissions ───────────────────────────────
  const resources = ["dashboard", "customers", "orders", "products", "subscriptions", "inventory", "payments", "cms", "support", "settings"];
  const actions = ["read", "write", "delete"];
  for (const resource of resources) {
    for (const action of actions) {
      const key = `${resource}.${action}`;
      await prisma.permission.upsert({
        where: { key }, update: {},
        create: { key, resource, action },
      });
    }
  }
  // Each role carries a declarative grant list. Grant specs expand as:
  //   "*"              → every permission
  //   "*.read"         → the read action on every resource
  //   "customers.*"    → all actions on one resource
  //   "orders.write"   → one exact permission
  // Every system role gets a sensible default set (least-privilege per function),
  // so onboarding a support agent or analyst grants only what that job needs —
  // no more "only super_admin actually works". Re-seeding SYNCS grants (system
  // roles are the source of truth), so tightening a role here rolls out on deploy.
  const roles: { key: string; name: string; scope: StaffScope; grants: string[] }[] = [
    { key: "super_admin", name: "Super Admin", scope: StaffScope.SUPER_ADMIN, grants: ["*"] },
    { key: "owner", name: "Owner", scope: StaffScope.OWNER, grants: ["*"] },
    {
      key: "manager", name: "Manager", scope: StaffScope.MANAGER,
      grants: ["dashboard.*", "customers.*", "orders.*", "products.*", "subscriptions.*", "inventory.*", "cms.*", "support.*", "payments.read", "settings.read"],
    },
    {
      key: "warehouse", name: "Warehouse", scope: StaffScope.WAREHOUSE,
      grants: ["dashboard.read", "orders.read", "orders.write", "inventory.read", "inventory.write", "products.read"],
    },
    {
      key: "finance", name: "Finance", scope: StaffScope.FINANCE,
      grants: ["dashboard.read", "payments.read", "payments.write", "orders.read", "subscriptions.read", "customers.read"],
    },
    {
      key: "marketing", name: "Marketing", scope: StaffScope.MARKETING,
      grants: ["dashboard.read", "cms.read", "cms.write", "cms.delete", "customers.read", "products.read"],
    },
    {
      key: "support", name: "Customer Support", scope: StaffScope.SUPPORT,
      grants: ["dashboard.read", "support.read", "support.write", "customers.read", "orders.read", "subscriptions.read"],
    },
    {
      key: "content", name: "Content Manager", scope: StaffScope.CONTENT,
      grants: ["dashboard.read", "cms.read", "cms.write", "cms.delete"],
    },
    {
      key: "delivery", name: "Delivery Team", scope: StaffScope.DELIVERY,
      grants: ["dashboard.read", "orders.read", "orders.write"],
    },
    { key: "analyst", name: "Read-only Analyst", scope: StaffScope.ANALYST, grants: ["*.read"] },
  ];
  const allPerms = await prisma.permission.findMany();
  const permId = new Map(allPerms.map((p) => [p.key, p.id]));
  const expandGrants = (grants: string[]): string[] => {
    const keys = new Set<string>();
    for (const g of grants) {
      if (g === "*") allPerms.forEach((p) => keys.add(p.key));
      else if (g.startsWith("*.")) {
        const action = g.slice(2);
        allPerms.filter((p) => p.action === action).forEach((p) => keys.add(p.key));
      } else if (g.endsWith(".*")) {
        const resource = g.slice(0, -2);
        allPerms.filter((p) => p.resource === resource).forEach((p) => keys.add(p.key));
      } else if (permId.has(g)) keys.add(g);
    }
    return [...keys];
  };
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { key: r.key }, update: { name: r.name, scope: r.scope },
      create: { key: r.key, name: r.name, scope: r.scope, isSystem: true },
    });
    // Sync this system role's grants to the matrix (idempotent).
    const wanted = expandGrants(r.grants);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: wanted.map((key) => ({ roleId: role.id, permissionId: permId.get(key)! })),
      skipDuplicates: true,
    });
  }
  console.log(`  ✓ RBAC: ${roles.length} roles, ${allPerms.length} permissions (grants synced)`);

  // ── Super-admin staff user (for the admin panel) ────────────────────────
  // NEVER plant a known-credential backdoor in production. The seed admin is
  // created only outside production, OR when an explicit ADMIN_SEED_PASSWORD is
  // provided (a one-off, operator-run prod bootstrap). The password is never
  // printed in production. Without ADMIN_SEED_PASSWORD in prod, this is skipped.
  const superAdminRole = await prisma.role.findUnique({ where: { key: "super_admin" } });
  const isProd = process.env.NODE_ENV === "production";
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? "admin@moraqat.sa";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? (isProd ? null : "Admin!2026");
  if (superAdminRole && adminPassword) {
    if (isProd && adminPassword.length < 12) {
      throw new Error("ADMIN_SEED_PASSWORD must be ≥12 chars in production.");
    }
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { isStaff: true, status: "ACTIVE" },
      create: {
        email: adminEmail,
        passwordHash: await hash(adminPassword, 12),
        firstName: "Moraqat",
        lastName: "Admin",
        isStaff: true,
        status: "ACTIVE",
        emailVerified: new Date(),
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: superAdminRole.id },
    });
    console.log(
      isProd
        ? `  ✓ admin user: ${adminEmail} (super_admin) — password from ADMIN_SEED_PASSWORD`
        : `  ✓ admin user: ${adminEmail} / ${adminPassword} (super_admin, dev only)`
    );
  } else if (superAdminRole) {
    console.log("  • admin user skipped (production without ADMIN_SEED_PASSWORD)");
  }

  // ── Feature flags ────────────────────────────────────────────────────────
  const flags = [
    { key: "smart_feeding_engine", enabled: true, description: "Vet-guideline quantity recommendations" },
    { key: "tabby_checkout", enabled: false, description: "Tabby BNPL at checkout" },
    { key: "tamara_checkout", enabled: false, description: "Tamara BNPL at checkout" },
    { key: "referral_program", enabled: true, description: "Referral earnings" },
    { key: "live_chat", enabled: true, description: "Support live chat widget" },
  ];
  for (const f of flags) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, update: {}, create: f });
  }
  console.log(`  ✓ feature flags: ${flags.length}`);

  // ── FAQs ──────────────────────────────────────────────────────────────────
  await prisma.faq.deleteMany({});
  await prisma.faq.createMany({
    data: [
      { questionEn: "Which cities do you deliver to?", questionAr: "ما هي المدن التي توصلون إليها؟", answerEn: "We currently deliver across Jeddah and Riyadh, with more Saudi cities coming soon.", answerAr: "نوصل حالياً إلى جدة والرياض، ومدن سعودية أخرى قريباً.", category: "delivery", sortOrder: 1 },
      { questionEn: "Can I pause or skip a month?", questionAr: "هل يمكنني إيقاف أو تخطي شهر؟", answerEn: "Yes — pause, skip, or reschedule anytime from your dashboard.", answerAr: "نعم — أوقف أو تخطَّ أو أعد الجدولة في أي وقت من لوحة التحكم.", category: "subscription", sortOrder: 2 },
      { questionEn: "How do you decide quantities?", questionAr: "كيف تحددون الكميات؟", answerEn: "Our Smart Feeding engine uses your cat's weight, age, breed and activity against veterinary guidelines.", answerAr: "يستخدم محرك التغذية الذكي وزن قطك وعمره وسلالته ونشاطه وفق الإرشادات البيطرية.", category: "feeding", sortOrder: 3 },
    ],
  });
  console.log("  ✓ FAQs");

  // ── Coupons ────────────────────────────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: { code: "WELCOME10", type: "PERCENTAGE", value: 10, isActive: true },
  });
  await prisma.coupon.upsert({
    where: { code: "FREESHIP" },
    update: {},
    create: { code: "FREESHIP", type: "FREE_SHIPPING", value: 0, isActive: true },
  });
  console.log("  ✓ coupons: WELCOME10, FREESHIP");

  // ── Blog (categories + published posts) ─────────────────────────────────
  const nutrition = await prisma.blogCategory.upsert({
    where: { slug: "nutrition" },
    update: {},
    create: { slug: "nutrition", nameEn: "Nutrition", nameAr: "التغذية" },
  });
  const careCat = await prisma.blogCategory.upsert({
    where: { slug: "cat-care" },
    update: {},
    create: { slug: "cat-care", nameEn: "Cat Care", nameAr: "العناية بالقطط" },
  });

  const posts = [
    {
      slug: "how-much-should-my-cat-eat",
      categoryId: nutrition.id,
      titleEn: "How much should my cat actually eat?",
      titleAr: "كم يجب أن يأكل قطك فعلياً؟",
      excerptEn: "Portion sizes by weight, age and activity — the vet-guideline method we use in our Smart Feeding engine.",
      excerptAr: "أحجام الوجبات حسب الوزن والعمر والنشاط — بالطريقة البيطرية التي نستخدمها في محرك التغذية الذكي.",
      bodyEn: "Most cats are overfed — and most owners are guessing.\n\nVets size portions from resting energy requirement (RER): 70 × weight^0.75 kcal per day, then multiply by a factor for life stage and activity. A neutered indoor adult sits around 1.2× RER; a growing kitten can need 2.5×.\n\nThat's exactly the calculation our Smart Feeding engine runs for every cat on your plan — so the box that arrives each month has the right amount of dry food, wet pouches and treats, not a guess.",
      bodyAr: "معظم القطط تُطعَم أكثر من حاجتها — ومعظم المربين يخمّنون.\n\nيحسب الأطباء البيطريون الوجبات من متطلب الطاقة الأساسي: ٧٠ × الوزن^٠٫٧٥ سعرة يومياً، مضروباً في معامل حسب العمر والنشاط. القط البالغ المعقم داخل المنزل يحتاج نحو ١٫٢×، بينما الهريرة النامية قد تحتاج ٢٫٥×.\n\nهذه هي الحسبة نفسها التي يجريها محرك التغذية الذكي لكل قط في اشتراكك — ليصلك صندوق كل شهر بالكمية الصحيحة، لا تخميناً.",
      authorName: "Moraqat Vet Team",
      status: "PUBLISHED" as const,
    },
    {
      slug: "indoor-cats-litter-guide",
      categoryId: careCat.id,
      titleEn: "The indoor cat litter guide for Saudi summers",
      titleAr: "دليل رمل القطط المنزلية في صيف السعودية",
      excerptEn: "Clumping vs crystal, how much you really need per month, and keeping odour down at 45°C.",
      excerptAr: "المتكتل مقابل الكريستال، وكم تحتاج فعلياً كل شهر، والتحكم بالرائحة في حرارة ٤٥ درجة.",
      bodyEn: "An indoor cat runs through roughly 7 kg of clumping litter a month — more in summer, when you should scoop twice daily.\n\nClumping clay is the best value for most households; crystal lasts longer but costs more per month. Whatever you pick, depth matters more than brand: keep 7 cm in the tray and odour drops dramatically.\n\nEvery Moraqat plan includes litter sized to your household, and you can bump quantities any month from your dashboard.",
      bodyAr: "يستهلك القط المنزلي نحو ٧ كجم من الرمل المتكتل شهرياً — وأكثر في الصيف حيث يُنصح بالتنظيف مرتين يومياً.\n\nالرمل الطيني المتكتل هو الأفضل قيمةً لمعظم المنازل؛ الكريستال يدوم أطول لكنه أغلى شهرياً. أياً كان اختيارك، العمق أهم من الماركة: حافظ على ٧ سم في الصندوق وستنخفض الرائحة كثيراً.\n\nكل باقات مرقط تشمل رملاً بكمية مناسبة لمنزلك، ويمكنك زيادتها في أي شهر من لوحة التحكم.",
      authorName: "Moraqat Vet Team",
      status: "PUBLISHED" as const,
    },
    {
      slug: "moving-to-wet-food",
      categoryId: nutrition.id,
      titleEn: "Switching your cat to more wet food, without drama",
      titleAr: "الانتقال إلى الطعام الرطب بدون دراما",
      excerptEn: "A 10-day transition plan that avoids upset stomachs and food strikes.",
      excerptAr: "خطة انتقال خلال ١٠ أيام تجنّب اضطراب المعدة وإضراب القط عن الطعام.",
      bodyEn: "Cats imprint on texture more than flavour. Go slowly: days 1–3, mix 25% wet into the usual dry. Days 4–6, half and half. Days 7–10, three quarters wet.\n\nIf your cat stalls, warm the pouch slightly — aroma does most of the persuading. Never leave wet food out more than 30 minutes in summer.\n\nOur Premium and Complete Care plans balance dry and wet automatically from your cat's calorie needs.",
      bodyAr: "تتعلق القطط بالقوام أكثر من النكهة. تدرّج ببطء: الأيام ١–٣ اخلط ٢٥٪ رطباً مع الجاف المعتاد. الأيام ٤–٦ مناصفة. الأيام ٧–١٠ ثلاثة أرباع رطب.\n\nإذا توقف قطك، دفّئ الكيس قليلاً — الرائحة تقوم بمعظم الإقناع. ولا تترك الطعام الرطب أكثر من ٣٠ دقيقة صيفاً.\n\nباقتا المميزة والعناية الكاملة توازنان الجاف والرطب تلقائياً حسب حاجة قطك من السعرات.",
      authorName: "Dr. Lama Al-Fahad",
      status: "PUBLISHED" as const,
    },
  ];
  for (const p of posts) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      update: { status: p.status },
      create: { ...p, publishedAt: new Date() },
    });
  }
  console.log(`  ✓ blog: 2 categories, ${posts.length} published posts`);

  // ── Testimonials ──────────────────────────────────────────────────────────
  // Intentionally empty. Testimonials must be REAL member voices captured after
  // launch — never invented (R006, honest by default). The prior seed shipped
  // fabricated delivery/savings quotes ("food arrives before we run out", "the
  // plan paid for itself") for experiences no one could have had pre-launch; those
  // are removed. Re-populate only from consented, real members via the admin CMS.
  await prisma.testimonial.deleteMany({});
  console.log("  ✓ testimonials: 0 (real voices only — see comment)");

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
