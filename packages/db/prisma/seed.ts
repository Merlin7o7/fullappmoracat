/**
 * Seed data for Moraqat.
 * Plans, prices, COGS and plan contents are taken directly from
 * Moraqat_Financial_Model.xlsx (Assumptions + Unit Economics tabs).
 */
import { PrismaClient, PlanTier, ProductType, StaffScope } from "@prisma/client";
import { hash } from "bcryptjs";

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

  // ── Plans + contents (directly from the financial model) ────────────────
  // COGS/box and price from Unit Economics tab.
  const plans = [
    {
      tier: PlanTier.ESSENTIAL, slug: "essential", nameEn: "Essential", nameAr: "الأساسية",
      basePrice: 179, cogs: 96.2,
      contents: [
        { label: "Dry food — mass (kg)", quantity: 2, unit: "kg", product: "dry-food-mass-2kg" },
        { label: "Wet pouch — mass", quantity: 15, unit: "pouch", product: "wet-pouch-mass-85g" },
        { label: "Litter (kg)", quantity: 7, unit: "kg", product: "clumping-litter-10kg" },
        { label: "Treats (packs)", quantity: 1, unit: "pack", product: "cat-treats-pack" },
      ],
    },
    {
      tier: PlanTier.PREMIUM, slug: "premium", nameEn: "Premium", nameAr: "المميزة",
      basePrice: 269, cogs: 148.2,
      contents: [
        { label: "Dry food — premium (kg)", quantity: 2, unit: "kg", product: "dry-food-premium-2kg" },
        { label: "Wet pouch — premium", quantity: 20, unit: "pouch", product: "wet-pouch-premium-85g" },
        { label: "Litter (kg)", quantity: 7, unit: "kg", product: "clumping-litter-10kg" },
        { label: "Treats (packs)", quantity: 1, unit: "pack", product: "cat-treats-pack" },
        { label: "Toy / enrichment", quantity: 1, unit: "each", product: "enrichment-toy" },
      ],
    },
    {
      tier: PlanTier.COMPLETE_CARE, slug: "complete-care", nameEn: "Complete Care", nameAr: "العناية الكاملة",
      basePrice: 389, cogs: 215.3,
      contents: [
        { label: "Dry food — premium (kg)", quantity: 2.5, unit: "kg", product: "dry-food-premium-2kg" },
        { label: "Wet pouch — premium", quantity: 25, unit: "pouch", product: "wet-pouch-premium-85g" },
        { label: "Litter (kg)", quantity: 8, unit: "kg", product: "clumping-litter-10kg" },
        { label: "Treats (packs)", quantity: 2, unit: "pack", product: "cat-treats-pack" },
        { label: "Dental (each)", quantity: 1, unit: "each", product: "dental-care-item" },
        { label: "Supplement (each)", quantity: 1, unit: "each", product: "monthly-supplement" },
        { label: "Toy / enrichment", quantity: 1, unit: "each", product: "enrichment-toy" },
      ],
    },
    {
      tier: PlanTier.MULTI_CAT, slug: "multi-cat", nameEn: "Multi-Cat", nameAr: "متعدد القطط",
      basePrice: 329, cogs: 190.4,
      contents: [
        { label: "Dry food — mass (kg)", quantity: 3.5, unit: "kg", product: "dry-food-mass-2kg" },
        { label: "Wet pouch — mass", quantity: 30, unit: "pouch", product: "wet-pouch-mass-85g" },
        { label: "Litter (kg)", quantity: 14, unit: "kg", product: "clumping-litter-10kg" },
        { label: "Treats (packs)", quantity: 2, unit: "pack", product: "cat-treats-pack" },
        { label: "Toy / enrichment", quantity: 1, unit: "each", product: "enrichment-toy" },
      ],
    },
  ];

  for (const [i, p] of plans.entries()) {
    const plan = await prisma.plan.upsert({
      where: { tier: p.tier },
      update: { basePrice: p.basePrice, cogs: p.cogs },
      create: {
        tier: p.tier, slug: p.slug, nameEn: p.nameEn, nameAr: p.nameAr,
        basePrice: p.basePrice, cogs: p.cogs, sortOrder: i,
      },
    });
    await prisma.planContent.deleteMany({ where: { planId: plan.id } });
    await prisma.planContent.createMany({
      data: p.contents.map((c) => ({
        planId: plan.id, label: c.label, quantity: c.quantity, unit: c.unit,
        productId: products[c.product],
      })),
    });
  }
  console.log(`  ✓ plans: ${plans.length} (with contents)`);

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
  const roles: { key: string; name: string; scope: StaffScope }[] = [
    { key: "super_admin", name: "Super Admin", scope: StaffScope.SUPER_ADMIN },
    { key: "owner", name: "Owner", scope: StaffScope.OWNER },
    { key: "manager", name: "Manager", scope: StaffScope.MANAGER },
    { key: "warehouse", name: "Warehouse", scope: StaffScope.WAREHOUSE },
    { key: "finance", name: "Finance", scope: StaffScope.FINANCE },
    { key: "marketing", name: "Marketing", scope: StaffScope.MARKETING },
    { key: "support", name: "Customer Support", scope: StaffScope.SUPPORT },
    { key: "content", name: "Content Manager", scope: StaffScope.CONTENT },
    { key: "delivery", name: "Delivery Team", scope: StaffScope.DELIVERY },
    { key: "analyst", name: "Read-only Analyst", scope: StaffScope.ANALYST },
  ];
  const allPerms = await prisma.permission.findMany();
  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { key: r.key }, update: {},
      create: { key: r.key, name: r.name, scope: r.scope, isSystem: true },
    });
    // Super admin gets every permission.
    if (r.key === "super_admin") {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermission.createMany({
        data: allPerms.map((p) => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`  ✓ RBAC: ${roles.length} roles, ${allPerms.length} permissions`);

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
  await prisma.testimonial.deleteMany({});
  await prisma.testimonial.createMany({
    data: [
      { authorName: "Sara M.", role: "Riyadh", quoteEn: "The feeding calculator nailed my Persian's portions — he finally stopped begging at 2am.", quoteAr: "حاسبة التغذية ضبطت وجبات قطي الشيرازي — أخيراً توقف عن التسوّل الساعة ٢ فجراً.", rating: 5, sortOrder: 1 },
      { authorName: "Abdullah K.", role: "Jeddah", quoteEn: "Litter and food arrive before we run out. I genuinely forgot what a pet-store run feels like.", quoteAr: "الرمل والطعام يصلان قبل أن ينفدا. نسيت فعلاً شكل مشوار محل الحيوانات.", rating: 5, sortOrder: 2 },
      { authorName: "Noura A.", role: "Riyadh", quoteEn: "Three cats, one box, zero math. The multi-cat plan paid for itself in the first month.", quoteAr: "ثلاث قطط، صندوق واحد، صفر حسابات. باقة متعدد القطط عوّضت ثمنها من أول شهر.", rating: 5, sortOrder: 3 },
    ],
  });
  console.log("  ✓ testimonials: 3");

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
