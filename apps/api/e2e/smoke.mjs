/**
 * Moraqat API smoke suite — condensed cross-domain E2E.
 * Assumes: API running at API_URL (default http://localhost:4000),
 * database pushed + seeded (plans, products, coupons, admin user).
 * Run directly (node e2e/smoke.mjs) or via e2e/run.mjs which boots the API.
 */
const base = `${process.env.API_URL ?? "http://localhost:4000"}/api`;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗ FAIL:", m); } };
const rnd = () => Math.random().toString(36).slice(2, 8);

async function call(path, method = "GET", body, token, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json; try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

console.log("━━ health ━━");
const health = await call("/../health"); // /health is outside the /api prefix
ok(health.json?.status === "ok" && health.json?.db === "up", `health ok, db up`);

console.log("━━ auth ━━");
const email = `smoke+${rnd()}@e.com`;
const reg = (await call("/auth/register", "POST", { email, password: "S3cure!pass", firstName: "Smoke", acceptTerms: true })).json;
ok(!!reg.accessToken && !!reg.refreshToken, "register issues token pair");
ok(reg.needsEmailVerification === true && reg.user?.emailVerified === false, "signup requires email verification (OTP)");
const C = reg.accessToken;
ok((await call("/cats")).status === 401, "guard blocks unauthenticated");
const rotated = (await call("/auth/refresh", "POST", { refreshToken: reg.refreshToken })).json;
ok(rotated.refreshToken && rotated.refreshToken !== reg.refreshToken, "refresh rotates");
ok((await call("/auth/refresh", "POST", { refreshToken: reg.refreshToken })).status === 401, "old refresh rejected");

console.log("━━ email OTP + community + uploads ━━");
ok((await call("/auth/email/otp/verify", "POST", { code: "000000" }, C)).status === 400, "wrong email OTP rejected (400)");
const community = await call("/community/cats");
ok(community.status === 200 && typeof community.json?.pagination?.total === "number", "community browse is public");
ok((await call("/uploads/image", "POST", {})).status === 401, "image upload requires auth (401)");

console.log("━━ cats + Cat ID + feeding ━━");
const cat = (await call("/cats", "POST", { name: "Smokey", weightKg: 4.5, activityLevel: "MODERATE", isIndoor: true }, C)).json;
ok(!!cat.id, "cat created");
// The Cat ID (Dossier §05): unique, human-readable, issued instantly (R032).
ok(/^MRC-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(cat.catIdNumber ?? ""), `Cat ID issued: ${cat.catIdNumber}`);
ok(!!cat.idIssuedAt, "issue date stamped");
const cat2 = (await call("/cats", "POST", { name: "Luna", activityLevel: "LOW", isIndoor: true }, C)).json;
ok(cat2.catIdNumber !== cat.catIdNumber, "Cat IDs are unique per cat");
const recommendation = (await call(`/feeding/cats/${cat.id}`, "POST", {}, C)).json;
ok(recommendation.dailyCalories > 200 && recommendation.estimatedMonthlyCostSar > 0, `feeding rec (${recommendation.dailyCalories} kcal)`);

console.log("━━ storefront + checkout (direct capture) ━━");
const plans = (await call("/plans")).json;
ok(plans.length === 4 && plans.every((p) => p.nameAr), "4 plans with Arabic names");
const dry = (await call("/products?type=DRY_FOOD&sort=price_asc")).json.items[0];
let cart = (await call("/cart", "POST")).json;
cart = (await call(`/cart/${cart.id}/items`, "POST", { productId: dry.id, quantity: 2 })).json;
cart = (await call(`/cart/${cart.id}/coupon`, "POST", { code: "WELCOME10" })).json;
ok(cart.totals.discountTotal > 0, "coupon applied");
const order = (await call("/checkout", "POST", { cartId: cart.id, provider: "MADA" }, C)).json;
ok(order.status === "CONFIRMED" && order.invoice?.status === "PAID", `order ${order.orderNumber} confirmed+paid`);
ok(Math.abs(order.grandTotal / 1.15 + order.taxTotal - order.grandTotal) < 0.05, "15% VAT broken out");
// Value made visible (R041): the savings tally reflects the coupon discount.
const ov = (await call("/account/overview", "GET", undefined, C)).json;
ok(ov.stats.totalSaved > 0, `savings tally visible (${ov.stats.totalSaved} SAR saved)`);
ok(ov.firstCat?.name === "Smokey" && !!ov.firstCat?.catIdNumber, "overview greets the cat by name + ID");

console.log("━━ pending flow + webhook ━━");
// Admin creates a product priced to trigger the mock PENDING path (total .77).
const admin = (await call("/auth/login", "POST", { email: "admin@moraqat.sa", password: "Admin!2026" })).json;
const A = admin.accessToken;
ok(!!A, "admin login");
const s = rnd();
const bnplProduct = (await call("/admin/products", "POST", { slug: `smoke-bnpl-${s}`, sku: `SMK-${s.toUpperCase()}`, type: "TOY", nameEn: "Smoke BNPL", nameAr: "دخان", price: 52.77 }, A)).json;
let cart2 = (await call("/cart", "POST")).json;
cart2 = (await call(`/cart/${cart2.id}/items`, "POST", { productId: bnplProduct.id, quantity: 1 })).json;
const pending = (await call("/checkout", "POST", { cartId: cart2.id, provider: "TABBY" }, C)).json;
ok(pending.status === "PENDING" && !!pending.redirectUrl, "BNPL checkout pending + redirect");
const badHook = await call("/payments/webhooks/mock", "POST", { providerRef: pending.payment.providerRef, status: "CAPTURED" }, undefined, { "x-webhook-secret": "wrong" });
ok(badHook.status === 401, "webhook bad signature 401");
const hook = await call("/payments/webhooks/mock", "POST", { providerRef: pending.payment.providerRef, status: "CAPTURED" }, undefined, { "x-webhook-secret": process.env.MOCK_WEBHOOK_SECRET ?? "mock-webhook-secret" });
ok(hook.json?.status === "captured", "webhook captures pending order");

console.log("━━ refunds + RBAC ━━");
ok((await call("/admin/dashboard", "GET", undefined, C)).status === 403, "customer blocked from admin (403)");
const refund = (await call(`/admin/orders/${order.orderNumber}/refund`, "POST", { amount: 10, reason: "smoke" }, A)).json;
ok(refund.refunded === 10, "partial refund via PSP");
const dash = (await call("/admin/dashboard", "GET", undefined, A)).json;
ok(dash.kpis.revenueTotal > 0 && dash.revenueByDay.length === 14, "analytics dashboard computes");

console.log("━━ cms ━━");
const blog = (await call("/content/blog")).json;
ok(blog.items.length >= 3, `public blog lists ${blog.items.length} posts`);
const draft = (await call("/admin/cms/posts", "POST", { slug: `smoke-post-${rnd()}`, titleEn: "Smoke", titleAr: "دخان" }, A)).json;
await call(`/admin/cms/posts/${draft.id}/publish`, "POST", {}, A);
const blogAfter = (await call("/content/blog")).json;
ok(blogAfter.items.some((p) => p.slug === draft.slug), "publish makes post public");

console.log("━━ support + notifications ━━");
const ticket = (await call("/support/tickets", "POST", { subject: "Smoke ticket", message: "Testing the flow" }, C)).json;
ok(ticket.status === "OPEN", `ticket ${ticket.ticketNumber} open`);
const replied = (await call(`/admin/support/tickets/${ticket.ticketNumber}/reply`, "POST", { body: "On it!" }, A)).json;
ok(replied.status === "PENDING", "staff reply → PENDING");
const notifs = (await call("/account/notifications", "GET", undefined, C)).json;
ok(notifs.some((n) => n.title.includes("Support replied")), "customer notified");
ok(notifs.some((n) => n.category === "ORDER"), "order notification emitted");

console.log(`\n${fail === 0 ? "✅ SMOKE PASS" : "❌ SMOKE FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
