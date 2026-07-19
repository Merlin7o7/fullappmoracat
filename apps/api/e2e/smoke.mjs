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
// The gate moved (fire #7 / <2-min north star): creating your OWN private cat
// no longer waits on email deliverability — only the action that publishes
// outward (community visibility) requires a verified email. The guard runs
// before the route handler, so it 403s even for a nonexistent cat id.
ok((await call("/cats/not-a-real-cat/visibility", "PATCH", { isPublic: true }, C)).status === 403, "community publish blocked before email verified (403)");
ok(!!reg.devEmailCode, "dev email code returned in non-prod");
ok((await call("/auth/email/otp/verify", "POST", { code: reg.devEmailCode }, C)).json?.verified === true, "email verified with correct code");
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

// ── The Census (MRC-GTM-001 §1) — the ordinal is the whole campaign ──────
// Founding Member is DERIVED from this number, so if the sequence ever stops
// being monotonic the badge starts lying. That is why this is asserted here
// rather than trusted to Postgres.
ok(Number.isInteger(cat.catNumber) && cat.catNumber > 0, `census ordinal assigned: #${cat.catNumber}`);
ok(cat2.catNumber === cat.catNumber + 1, "census ordinals are sequential and monotonic");
ok(cat.isFoundingMember === (cat.catNumber <= 1000), "founding status is derived from the ordinal, not stored");
// The ordinal must be immutable — a PATCH must never be able to buy seniority.
// The request may be refused outright (whitelist validation) or accepted and
// ignored; either is fine. What is NOT fine is the number actually moving, so
// that is what we assert — by re-reading the cat rather than trusting the
// mutation's own response body.
const tamper = await call(`/cats/${cat.id}`, "PATCH", { name: "Smokey II", catNumber: 1 }, C);
const reread = (await call(`/cats/${cat.id}`, "GET", undefined, C)).json;
ok(
  reread.catNumber === cat.catNumber,
  `census ordinal survives a client PATCH attempt (status ${tamper.status}, still #${reread.catNumber})`
);

// Acquisition attribution: the stand code must round-trip and stay put.
const standCat = (await call("/cats", "POST", { name: "Stand Cat", activityLevel: "LOW", isIndoor: true, sourceCode: "STAND-004" }, C)).json;
ok(standCat.catNumber === cat2.catNumber + 1, "ordinals keep incrementing across sources");
const standPatched = (await call(`/cats/${standCat.id}`, "PATCH", { sourceCode: "stand-999" }, C)).json;
ok(standPatched.id === standCat.id, "cat updated after source capture");

console.log("━━ census counter ━━");
const census = (await call("/census")).json;
ok(typeof census?.registered === "number" && census.registered > 0, `census count is public and real: ${census?.registered}`);
ok(census?.foundingLimit === 1000, "founding cohort size is 1000");
ok(typeof census?.foundingClosed === "boolean", "founding-closed flag derived from the high-water ordinal");
// R006: the census must never publish a scarcity clock.
ok(!("remaining" in (census ?? {})) && !("spotsLeft" in (census ?? {})), "census exposes no 'places remaining' countdown (R006)");
const censusAgain = (await call("/census")).json;
ok(censusAgain.registered >= census.registered, "census count never goes backwards");
const recommendation = (await call(`/feeding/cats/${cat.id}`, "POST", {}, C)).json;
ok(recommendation.dailyCalories > 200 && recommendation.estimatedMonthlyCostSar > 0, `feeding rec (${recommendation.dailyCalories} kcal)`);

console.log("━━ wallet pass (R034) ━━");
{
  const { verify: rsaVerify } = await import("node:crypto");
  ok((await call("/wallet/availability")).status === 401, "wallet availability requires auth");
  const avail = (await call("/wallet/availability", "GET", undefined, C)).json;
  ok(avail.google === true && avail.apple === false, "availability reflects configured targets (google on, apple off)");
  const { saveUrl } = (await call(`/wallet/cats/${cat.id}/google`, "GET", undefined, C)).json;
  ok(saveUrl?.startsWith("https://pay.google.com/gp/v/save/"), "google save URL issued");
  const jwt = saveUrl.split("/save/")[1];
  const [h, p, sig] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  const obj = claims.payload?.genericObjects?.[0];
  ok(claims.typ === "savetowallet" && claims.aud === "google", "JWT claims shaped for Save to Wallet");
  ok(obj?.id?.endsWith(cat.catIdNumber) && obj?.barcode?.value === `MRCV1:${cat.qrToken}`, "pass carries the Cat ID + secure QR token (never a URL)");
  // The runner escapes newlines so the PEM survives Windows spawn env — restore them.
  const pub = process.env.WALLET_GOOGLE_TEST_PUBLIC_KEY?.replace(/\\n/g, "\n");
  ok(!!pub && rsaVerify("RSA-SHA256", Buffer.from(`${h}.${p}`), pub, Buffer.from(sig, "base64url")), "JWT signature verifies (RS256)");
  // Cross-account isolation: another user's cat must 404, never leak a pass.
  const other = (await call("/auth/register", "POST", { email: `smoke+${rnd()}@e.com`, password: "S3cure!pass", firstName: "Other", acceptTerms: true })).json;
  ok((await call(`/wallet/cats/${cat.id}/google`, "GET", undefined, other.accessToken)).status === 404, "cross-account wallet access blocked (404)");
}

console.log("━━ storefront + checkout (direct capture) ━━");
const plans = (await call("/plans")).json;
ok(plans.length === 3 && plans.every((p) => p.nameAr), "3 official plans with Arabic names");
// The box must be a genuine saving against our own shelf prices — it previously
// cost 19–35% MORE than buying the same items à-la-carte.
ok(plans.every((p) => p.retailValue > p.price), "every plan undercuts its own à-la-carte value");
ok(plans.every((p) => p.savingsPct >= 15), `every plan saves >=15% (${plans.map((p) => p.savingsPct + "%").join(", ")})`);
// Arabic box contents must exist, or the Arabic checkout renders English.
ok(plans.every((p) => p.contents.every((c) => c.labelAr && c.unitAr)), "box contents carry Arabic label + unit");
// Admin login early: the storefront test buys an admin-created product, since the
// imported supplier catalog stays unpublished (individual store not public yet).
const admin = (await call("/auth/login", "POST", { email: "admin@moraqat.sa", password: "Admin!2026" })).json;
const A = admin.accessToken;
ok(!!A, "admin login");
const ss = rnd();
const dry = (await call("/admin/products", "POST", { slug: `smoke-dry-${ss}`, sku: `SMKD-${ss.toUpperCase()}`, type: "DRY_FOOD", nameEn: "Smoke Dry", nameAr: "جاف", price: 49 }, A)).json;
let cart = (await call("/cart", "POST")).json;
// Returned exactly once, at creation — later views never re-expose it.
const guestToken = cart.guestToken;
ok(!!guestToken, "guest cart mints a capability token");
const CT = { "x-cart-token": guestToken };
// A cart id is a routing identifier, not a credential: without the token an
// attacker who guesses/obtains an id must not be able to read or mutate it.
ok((await call(`/cart/${cart.id}`)).status === 404, "guest cart unreadable without token");
ok((await call(`/cart/${cart.id}/items`, "POST", { productId: dry.id, quantity: 1 })).status === 404,
  "guest cart unmutatable without token");
cart = (await call(`/cart/${cart.id}/items`, "POST", { productId: dry.id, quantity: 2 }, undefined, CT)).json;
cart = (await call(`/cart/${cart.id}/coupon`, "POST", { code: "WELCOME10" }, undefined, CT)).json;
ok(cart.totals.discountTotal > 0, "coupon applied");
const order = (await call("/checkout", "POST", { cartId: cart.id, cartToken: guestToken, provider: "MADA" }, C)).json;
ok(order.status === "CONFIRMED" && order.invoice?.status === "PAID", `order ${order.orderNumber} confirmed+paid`);
ok(Math.abs(order.taxTotal) < 0.01, "0% VAT (Moracat not VAT-registered)");
// Value made visible (R041): the savings tally reflects the coupon discount.
const ov = (await call("/account/overview", "GET", undefined, C)).json;
ok(ov.stats.totalSaved > 0, `savings tally visible (${ov.stats.totalSaved} SAR saved)`);
ok(ov.firstCat?.name === "Smokey" && !!ov.firstCat?.catIdNumber, "overview greets the cat by name + ID");

console.log("━━ pending flow + webhook ━━");
// Admin (logged in above) creates a product priced to trigger mock PENDING (.77).
const s = rnd();
const bnplProduct = (await call("/admin/products", "POST", { slug: `smoke-bnpl-${s}`, sku: `SMK-${s.toUpperCase()}`, type: "TOY", nameEn: "Smoke BNPL", nameAr: "دخان", price: 52.77 }, A)).json;
let cart2 = (await call("/cart", "POST")).json;
const guestToken2 = cart2.guestToken;
const CT2 = { "x-cart-token": guestToken2 };
cart2 = (await call(`/cart/${cart2.id}/items`, "POST", { productId: bnplProduct.id, quantity: 1 }, undefined, CT2)).json;
const pending = (await call("/checkout", "POST", { cartId: cart2.id, cartToken: guestToken2, provider: "TABBY" }, C)).json;
ok(pending.status === "PENDING" && !!pending.redirectUrl, "BNPL checkout pending + redirect");
const badHook = await call("/payments/webhooks/mock", "POST", { providerRef: pending.payment.providerRef, status: "CAPTURED" }, undefined, { "x-webhook-secret": "wrong" });
ok(badHook.status === 401, "webhook bad signature 401");
const hook = await call("/payments/webhooks/mock", "POST", { providerRef: pending.payment.providerRef, status: "CAPTURED" }, undefined, { "x-webhook-secret": process.env.MOCK_WEBHOOK_SECRET ?? "mock-webhook-secret" });
ok(hook.json?.status === "captured", "webhook captures pending order");

console.log("━━ security regressions ━━");
// Cross-account cart takeover: a second member must not be able to check out
// (or destroy) a cart owned by someone else, even with a valid cart id.
const victimEmail = `victim+${rnd()}@e.com`;
const victim = (await call("/auth/register", "POST", { email: victimEmail, password: "S3cure!pass", firstName: "Victim", acceptTerms: true })).json;
let vCart = (await call("/cart", "POST")).json;
const vToken = vCart.guestToken;
await call(`/cart/${vCart.id}/items`, "POST", { productId: dry.id, quantity: 1 }, undefined, { "x-cart-token": vToken });
// Claim it for the victim, which clears the guest token.
ok((await call(`/cart/${vCart.id}`, "GET", undefined, victim.accessToken, { "x-cart-token": vToken })).status === 200,
  "signed-in user claims their guest cart");
ok((await call(`/cart/${vCart.id}`, "GET", undefined, C)).status === 404,
  "another member cannot read an owned cart");
ok((await call("/checkout", "POST", { cartId: vCart.id, provider: "MADA" }, C)).status === 404,
  "another member cannot check out an owned cart");
ok((await call(`/cart/${vCart.id}`, "GET", undefined, undefined, { "x-cart-token": vToken })).status === 404,
  "guest token is revoked once the cart is claimed");

// Unsettleable rails must be refused at the edge, not routed to the mock —
// otherwise a live request marks an order paid with zero money moved.
ok((await call("/checkout", "POST", { cartId: vCart.id, provider: "WALLET" }, victim.accessToken)).status === 400,
  "WALLET rejected (no settlement engine)");
ok((await call("/checkout", "POST", { cartId: vCart.id, provider: "GIFT_CARD" }, victim.accessToken)).status === 400,
  "GIFT_CARD rejected (no settlement engine)");

console.log("━━ commerce integrity ━━");
// Idempotency: the same key must replay the first result, never charge twice.
const idemCart = (await call("/cart", "POST")).json;
await call(`/cart/${idemCart.id}/items`, "POST", { productId: dry.id, quantity: 1 }, undefined, { "x-cart-token": idemCart.guestToken });
const idemKey = `idem-${rnd()}${rnd()}`;
const idemBody = { cartId: idemCart.id, cartToken: idemCart.guestToken, provider: "MADA" };
const first = await call("/checkout", "POST", idemBody, C, { "idempotency-key": idemKey });
const replay = await call("/checkout", "POST", idemBody, C, { "idempotency-key": idemKey });
ok(first.json?.orderNumber && replay.json?.orderNumber === first.json.orderNumber,
  "idempotency-key replays the original order instead of charging twice");
const idemOrders = (await call("/orders", "GET", undefined, C)).json;
ok(idemOrders.filter((o) => o.orderNumber === first.json.orderNumber).length === 1,
  "replayed checkout created exactly one order");

// Concurrent double-tap on one cart: the status claim must let exactly one win.
const raceCart = (await call("/cart", "POST")).json;
await call(`/cart/${raceCart.id}/items`, "POST", { productId: dry.id, quantity: 1 }, undefined, { "x-cart-token": raceCart.guestToken });
const raceBody = { cartId: raceCart.id, cartToken: raceCart.guestToken, provider: "MADA" };
const [r1, r2] = await Promise.all([
  call("/checkout", "POST", raceBody, C),
  call("/checkout", "POST", raceBody, C),
]);
const created = [r1, r2].filter((r) => r.status === 201).length;
ok(created === 1, `concurrent checkout on one cart creates exactly one order (got ${created})`);

// A redemption ledger row is written for every coupon actually used, which is
// what makes perUserLimit enforceable (unit-tested in common/coupons.test.ts).
const couponOrder = idemOrders.find((o) => o.couponCode === "WELCOME10");
ok(!!couponOrder, "coupon-bearing order recorded with its code");

console.log("━━ webhook integrity ━━");
const HOOK = { "x-webhook-secret": process.env.MOCK_WEBHOOK_SECRET ?? "mock-webhook-secret" };
// Build a fresh pending order to settle.
const whCart = (await call("/cart", "POST")).json;
await call(`/cart/${whCart.id}/items`, "POST", { productId: bnplProduct.id, quantity: 1 }, undefined, { "x-cart-token": whCart.guestToken });
const whOrder = (await call("/checkout", "POST", { cartId: whCart.id, cartToken: whCart.guestToken, provider: "TABBY" }, C)).json;
const whRef = whOrder.payment.providerRef;

// An unknown/non-actionable event must be a no-op, NOT a failure. Previously
// anything unrecognised voided the invoice and emailed the shopper.
const unknownEvt = await call("/payments/webhooks/mock", "POST", { providerRef: whRef, status: "SOMETHING_NEW" }, undefined, HOOK);
const afterUnknown = (await call(`/orders/${whOrder.orderNumber}`, "GET", undefined, C)).json;
ok(afterUnknown.status === "PENDING", "unknown webhook event leaves the order untouched");

// Replay: the same event id must settle once.
const evtId = `evt-${rnd()}${rnd()}`;
const cap1 = await call("/payments/webhooks/mock", "POST", { providerRef: whRef, status: "CAPTURED", eventId: evtId }, undefined, HOOK);
const cap2 = await call("/payments/webhooks/mock", "POST", { providerRef: whRef, status: "CAPTURED", eventId: evtId }, undefined, HOOK);
ok(cap1.json?.status === "captured", "first delivery captures");
ok(cap2.json?.status === "replayed", "replayed delivery is suppressed");

// Refund reconciliation: order + invoice must move together, with a Refund row.
const refundEvt = await call("/payments/webhooks/mock", "POST", { providerRef: whRef, status: "REFUNDED", eventId: `evt-${rnd()}${rnd()}` }, undefined, HOOK);
ok(refundEvt.json?.status === "refunded", "PSP-initiated refund is processed");
const refunded = (await call(`/orders/${whOrder.orderNumber}`, "GET", undefined, C)).json;
ok(refunded.status === "RETURNED" && refunded.invoice?.status === "REFUNDED",
  "refund reconciles order + invoice (books no longer say 'paid')");

console.log("━━ membership activation (plan builder → checkout) ━━");
// The plan is computed from the cat and bought on one honest page (D2/D3):
// charge-first, VAT broken out, first renewal exactly one month out (R021).
const cities = (await call("/cities")).json;
const addr = (await call("/addresses", "POST", { recipient: "Smoke Tester", phone: "+966500000001", cityId: cities[0].id, street: "Smoke St 1" }, C)).json;
ok(!!addr.id, "delivery address saved");
const term = 3; // minimum committed term; member pays monthly × term upfront
// Tamara is the only accepted provider; PAYMENTS_MODE=mock resolves it to the
// mock adapter (direct capture) so the activation path is still exercised here.
const sub = (await call("/subscriptions/activate", "POST", { planId: plans[0].id, catIds: [cat.id], addressId: addr.id, provider: "TAMARA", termMonths: term }, C)).json;
ok(sub.status === "ACTIVE" && !!sub.nextBillingAt, `membership activated (${sub.orderNumber})`);
ok(Math.abs(sub.grandTotal - plans[0].price * term) < 0.01, `upfront total = monthly × ${term} months`);
ok(Math.abs(sub.taxTotal) < 0.01, "membership 0% VAT (not VAT-registered)");
const billAt = new Date(sub.nextBillingAt);
const expectBill = new Date(); expectBill.setMonth(expectBill.getMonth() + term);
ok(Math.abs(billAt - expectBill) < 36e5 * 25, `renewal at term end (${term} months, R021/R025)`);

// ── auto-renew: opt-out by default, one tap off, never chargeable without a
// credential that can actually be charged off-session.
const subId = sub.subscriptionId;
ok((await call(`/subscriptions/${subId}`, "GET", undefined, C)).json?.autoRenew !== true,
  "auto-renew is OFF by default (no member is retroactively enrolled)");
const noPm = await call(`/subscriptions/${subId}/auto-renew`, "POST", { enabled: true }, C);
ok(noPm.status === 400, "enabling auto-renew without a payment method is rejected");
const offAgain = await call(`/subscriptions/${subId}/auto-renew`, "POST", { enabled: false }, C);
ok(offAgain.status === 201 && offAgain.json?.autoRenew === false && !!offAgain.json?.notice?.ar,
  "auto-renew can be turned off in one call, with honest bilingual copy");
// Ownership: another member must not be able to touch this subscription.
ok((await call(`/subscriptions/${subId}/auto-renew`, "POST", { enabled: false }, victim.accessToken)).status === 404,
  "auto-renew is scoped to the owner");
const coveredCat = (await call(`/cats/${cat.id}`, "GET", undefined, C)).json;
ok(coveredCat.membershipStatus === "ACTIVE", "cat membership flips ACTIVE on capture");
// One cat, one membership — the double-charge is prevented, never refunded (R115).
const dupe = await call("/subscriptions/activate", "POST", { planId: plans[1].id, catIds: [cat.id], addressId: addr.id, provider: "TAMARA" }, C);
ok(dupe.status === 400, "second membership for a covered cat is rejected (400)");
// Box builder: each choosable line offers brand/flavor options — in-stock first,
// popular "to-source" flagged, one recommended default.
const box = (await call(`/plans/${plans[0].id}/box`, "GET", undefined, C)).json;
const selLine = box.lines.find((l) => l.selectable && (l.options?.length ?? 0) > 1);
ok(
  !!selLine && selLine.options.some((o) => o.recommended) && selLine.options.some((o) => !o.inStock),
  "box options: recommended default + honest to-source flag"
);
const cat1 = (await call("/cats", "POST", { name: "Monthly", weightKg: 4, activityLevel: "LOW", isIndoor: true }, C)).json;
// An invalid brand/flavor pick fails the box BEFORE any charge (R115) — cat stays uncovered.
const badSel = await call("/subscriptions/activate", "POST", { planId: plans[0].id, catIds: [cat1.id], addressId: addr.id, provider: "TAMARA", selections: [{ contentId: selLine.contentId, productId: "does-not-exist" }] }, C);
ok(badSel.status === 400, "invalid box selection rejected before charge (400)");
// A single month is now a valid low-commitment entry (termMonths:1); the member's
// chosen brand/flavor is saved on the box.
const pickOpt = selLine.options.find((o) => !o.recommended) ?? selLine.options[0];
const sub1 = (await call("/subscriptions/activate", "POST", { planId: plans[0].id, catIds: [cat1.id], addressId: addr.id, provider: "TAMARA", termMonths: 1, selections: [{ contentId: selLine.contentId, productId: pickOpt.productId }] }, C)).json;
ok(sub1.status === "ACTIVE" && Math.abs(sub1.grandTotal - plans[0].price) < 0.01, "1-month membership activates (price × 1 upfront)");
const sub1full = (await call(`/subscriptions/${sub1.subscriptionId}`, "GET", undefined, C)).json;
ok((sub1full.items ?? []).some((i) => i.productId === pickOpt.productId), "chosen brand/flavor saved on the box (flat price)");

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

console.log("━━ community: onboarding · likes · notifications ━━");
// First Cat ID routes the member through the one-time welcome; later cats don't.
ok(cat.firstCatIdIssued === true, "first Cat ID sets firstCatIdIssued (welcome trigger)");
ok(cat2.firstCatIdIssued === false, "second Cat ID does NOT re-trigger the welcome");
// Share Smokey publicly, then a second member likes them.
const shared = (await call(`/cats/${cat.id}/visibility`, "PATCH", { isPublic: true, showBreed: true }, C)).json;
ok(shared.isPublic === true && !!shared.publicSlug, "cat made public with a slug");
const slug = shared.publicSlug;
const liker = (await call("/auth/register", "POST", { email: `liker-${rnd()}@smoke.test`, password: "Passw0rd!23", fullName: "Liker Smoke", acceptTerms: true })).json;
const L = liker.accessToken;
// Liking is an email-verified community write — verify first.
await call("/auth/email/otp/verify", "POST", { code: liker.devEmailCode }, L);
const like1 = (await call(`/community/cats/${slug}/like`, "POST", undefined, L)).json;
ok(like1.liked === true && like1.likeCount === 1, "like registers (count 1)");
const like2 = (await call(`/community/cats/${slug}/like`, "POST", undefined, L)).json;
ok(like2.likeCount === 1, "like is idempotent (still 1 on repeat)");
const myLikes = (await call("/community/my-likes", "GET", undefined, L)).json;
ok(Array.isArray(myLikes) && myLikes.includes(slug), "my-likes returns the liked slug");
const loved = (await call("/community/cats?sort=liked")).json;
ok(loved.items[0]?.slug === slug && loved.items[0]?.likeCount === 1, "Most-Loved sort ranks by likeCount");
const unlike = (await call(`/community/cats/${slug}/like`, "DELETE", undefined, L)).json;
ok(unlike.liked === false && unlike.likeCount === 0, "unlike decrements to 0");

// Reported content → moderation queue → audit trail (C3/C4).
const rep = (await call(`/community/cats/${slug}/report`, "POST", { reason: "SPAM", detail: "smoke report" }, L)).json;
ok(rep.reported === true, "member can report a public cat");
const reports = (await call("/admin/community/reports?status=PENDING", "GET", undefined, A)).json;
const myReport = reports.items?.find((r) => r.cat.publicSlug === slug);
ok(!!myReport, "report appears in the moderation queue");
const resolved = (await call(`/admin/community/reports/${myReport.id}/resolve`, "PATCH", { action: "dismiss" }, A)).json;
ok(resolved.resolved === true, "admin resolves (dismisses) a report");
const audit = (await call("/admin/audit?action=community.report", "GET", undefined, A)).json;
ok(audit.items?.some((e) => e.action === "community.report.dismiss"), "audit log viewer records the dismissal");
// The owner sees in-app community notifications with a readable API.
const feed = (await call("/notifications", "GET", undefined, C)).json;
ok(Array.isArray(feed.items) && typeof feed.unread === "number", "notifications read API returns items + unread");
ok(feed.items.some((n) => n.category === "COMMUNITY"), "community notifications emitted to owner");
const uc = (await call("/notifications/unread-count", "GET", undefined, C)).json;
ok(typeof uc.unread === "number", "unread-count endpoint works");
const readAll = (await call("/notifications/read-all", "PATCH", undefined, C)).json;
ok(readAll.success === true, "mark-all-read works");
const uc2 = (await call("/notifications/unread-count", "GET", undefined, C)).json;
ok(uc2.unread === 0, "unread drops to 0 after mark-all-read");

// Wave 8: referral loop, notification preferences, profile completion.
const ref = (await call("/account/referral", "GET", undefined, C)).json;
ok(!!ref.code && ref.link.includes(ref.code), "referral code + invite link issued");
const prefs = (await call("/account/notification-preferences", "GET", undefined, C)).json;
ok(Array.isArray(prefs) && prefs.some((p) => p.category === "COMMUNITY"), "notification preferences load");
const ovc = (await call("/account/overview", "GET", undefined, C)).json;
ok(ovc.primaryCat?.completion && typeof ovc.primaryCat.completion.percent === "number", "profile completion computed on overview");
// Arabic search normalization: a diacritic-free query finds a diacritic name.
const arCat = (await call("/cats", "POST", { name: "مِشْمِش", activityLevel: "LOW", isIndoor: true }, C)).json;
await call(`/cats/${arCat.id}/visibility`, "PATCH", { isPublic: true }, C);
const arSearch = (await call(`/community/cats?search=${encodeURIComponent("مشمش")}`)).json;
ok(arSearch.pagination.total >= 1, "Arabic search matches across diacritics/tatweel");

console.log(`\n${fail === 0 ? "✅ SMOKE PASS" : "❌ SMOKE FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
