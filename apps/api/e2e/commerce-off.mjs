/**
 * Community-Mode kill-switch suite — run against an API booted with
 * COMMERCE_ENABLED=false (see run.mjs, which boots a second instance for this).
 *
 * The main smoke suite deliberately runs with commerce ON so the still-present
 * payment engine keeps getting exercised. That means nothing in it can prove
 * the switch actually works. This file is the other half: it asserts that
 * while the switch is off, **no path reaches a price, a checkout, a payment or
 * a membership activation** — and that everything the census needs still does.
 *
 * Phase 0 (MRC-GTM-001 §1): for ~6 weeks the site's only job is registering
 * free Cat IDs. If any assertion here fails, the site is selling something it
 * cannot deliver (R040).
 */
const base = `${process.env.API_URL ?? "http://localhost:4100"}/api`;
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

/** The documented refusal: a graceful, machine-readable 403 — never a 404 or a 500. */
const blocked = async (path, method = "GET", body, token) => {
  const r = await call(path, method, body, token);
  return r.status === 403 && r.json?.code === "MEMBERSHIPS_COMING_SOON";
};

console.log("━━ community mode · health ━━");
const health = await call("/../health");
ok(health.json?.status === "ok" && health.json?.db === "up", "API boots with commerce disabled");

// A real member, so the gated routes are refused for *commerce* reasons and
// not merely because nobody is logged in — a 401 would prove nothing.
const email = `killswitch+${rnd()}@e.com`;
const reg = (await call("/auth/register", "POST", { email, password: "S3cure!pass", firstName: "Kill", acceptTerms: true })).json;
const C = reg.accessToken;
ok(!!C, "member can still register an account while commerce is off");

console.log("━━ pricing surfaces are unreachable ━━");
ok(await blocked("/plans"), "GET /plans blocked (the 249/349/529 pricing oracle)");
ok(await blocked("/plans/any-id/box"), "GET /plans/:id/box blocked (supplier catalog + stock)");
ok(await blocked("/products"), "GET /products blocked (per-product prices)");
ok(await blocked("/products/any-slug"), "GET /products/:slug blocked");

console.log("━━ cart engine is unreachable ━━");
// Paths mirror cart.controller.ts exactly — a wrong path 404s, which would
// pass a naive "not 200" check while proving nothing.
ok(await blocked("/cart", "POST", {}, C), "POST /cart blocked (cart creation)");
ok(await blocked("/cart/any-id", "GET", undefined, C), "GET /cart/:id blocked (subtotal/grandTotal)");
ok(await blocked("/cart/any-id/items", "POST", { productId: "x", quantity: 1 }, C), "POST /cart/:id/items blocked");
// The coupon endpoint is also a discount-validity oracle — worth its own assertion.
ok(await blocked("/cart/any-id/coupon", "POST", { code: "WELCOME" }, C), "coupon validation blocked (no discount oracle)");

console.log("━━ money paths are unreachable ━━");
ok(await blocked("/checkout", "POST", { planId: "x" }, C), "POST /checkout blocked");
ok(await blocked("/subscriptions/activate", "POST", { planId: "x" }, C), "membership activation blocked");
ok(await blocked("/orders", "GET", undefined, C), "GET /orders blocked (invoice totals + VAT)");
ok(await blocked("/invoices", "GET", undefined, C), "GET /invoices blocked");
// The webhook is gated too. This is SAFE ONLY while no real payment is in
// flight — see the hazard note on webhooks.controller.ts before flipping the
// switch off once real money exists.
ok(await blocked("/payments/webhooks/mock", "POST", { event: "noop" }), "PSP webhook blocked (see hazard note before launch)");

console.log("━━ no response leaks a price ━━");
// Belt and braces: scan every public/member-reachable payload a visitor could
// pull for a SAR amount or a known plan price. A route that 403s can't leak,
// but a route someone forgets to gate would show up right here.
const openPaths = ["/census", "/content/faqs", "/content/announcements", "/content/testimonials", "/content/blog", "/community/cats", "/community/facets"];
for (const p of openPaths) {
  const r = await call(p);
  const body = JSON.stringify(r.json ?? "");
  const leak = /\b(249|349|529)\b/.test(body) || /"price"|"grandTotal"|"termTotal"|"compareAtPrice"/.test(body);
  ok(!leak, `no price leaks from ${p}`);
}

console.log("━━ the census still works — this is the front door ━━");
const census = (await call("/census")).json;
ok(typeof census?.registered === "number", `census count served with commerce off: ${census?.registered}`);
ok(census?.foundingLimit === 1000, "founding cohort size published");
ok(!("remaining" in (census ?? {})), "still no scarcity countdown (R006)");

const cat = (await call("/cats", "POST", { name: "Census Cat", activityLevel: "LOW", isIndoor: true, gender: "FEMALE", birthDate: "2023-06-01", cityCode: "makkah", sourceCode: "stand-004" }, C)).json;
ok(!!cat.id && /^MRC-/.test(cat.catIdNumber ?? ""), "Cat ID is still issued free while commerce is off");
ok(Number.isInteger(cat.catNumber) && cat.catNumber > 0, `census ordinal still assigned: #${cat.catNumber}`);
ok(cat.isFoundingMember === (cat.catNumber <= 1000), "founding status still derived correctly");

console.log("━━ waitlist + consent (PDPL, R106) ━━");
const wlEmail = `wl+${rnd()}@e.com`;
const noConsent = (await call("/waitlist", "POST", { email: wlEmail, catName: "Census Cat", source: "stand-004" })).json;
ok(noConsent?.ok === true, "waitlist accepts an entry without consent");
ok(noConsent?.consentRecorded === false, "no consent stamped when the box wasn't ticked");
const withConsent = (await call("/waitlist", "POST", { email: wlEmail, consent: true, source: "stand-004" })).json;
ok(withConsent?.consentRecorded === true, "consent stamped server-side when given");
ok(typeof withConsent?.position === "number" && withConsent.position > 0, `honest waitlist position returned: ${withConsent?.position}`);
// Sticky consent: a later submit without the box must not silently revoke it.
const resubmit = (await call("/waitlist", "POST", { email: wlEmail, source: "stand-004" })).json;
ok(resubmit?.consentRecorded === true, "consent is not revoked by a later consent-less submit");

console.log(`\n${fail === 0 ? "✅ COMMUNITY-MODE PASS" : "❌ COMMUNITY-MODE FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
