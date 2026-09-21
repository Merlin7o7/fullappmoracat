/**
 * The cat's life beyond one household — adoption, Cat ID ownership transfer,
 * Lost & Found, the "no cat yet" door, and the admin's vet demo.
 *
 * WHY ITS OWN SUITE
 * These features share one dangerous property: they move a real animal's
 * identity and medical record between two people, or publish something about
 * a household to strangers. The failure modes are not "a button doesn't work"
 * — they are "a cat has two owners", "a cat has none", "the previous owner can
 * still read the record", and "a public page leaked an email". Every one of
 * those is asserted here, by re-reading the server rather than trusting a
 * mutation's own response.
 *
 * Assumes the API is running (e2e/run.mjs boots it) against a seeded database.
 */
const base = `${process.env.API_URL ?? "http://localhost:4000"}/api`;
let pass = 0,
  fail = 0;
const ok = (c, m) => {
  if (c) {
    pass++;
    console.log("  ✓", m);
  } else {
    fail++;
    console.log("  ✗ FAIL:", m);
  }
};
const rnd = () => Math.random().toString(36).slice(2, 8);

async function call(path, method = "GET", body, token, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** A verified member — adoption writes require a verified email, as UGC does. */
async function member(label) {
  const email = `${label}+${rnd()}@e.com`;
  const reg = (
    await call("/auth/register", "POST", {
      email,
      password: "S3cure!pass",
      firstName: label,
      acceptTerms: true,
    })
  ).json;
  if (reg.devEmailCode) {
    await call("/auth/email/otp/verify", "POST", { code: reg.devEmailCode }, reg.accessToken);
  }
  return { email, token: reg.accessToken, id: reg.user?.id };
}

const newCat = (token, name, extra = {}) =>
  call(
    "/cats",
    "POST",
    {
      name,
      activityLevel: "MODERATE",
      isIndoor: true,
      gender: "MALE",
      birthDate: "2022-05-01",
      cityCode: "riyadh",
      photoUrl: "https://cdn.example.com/cat.jpg",
      ...extra,
    },
    token
  ).then((r) => r.json);

// ════════════════════════════════════════════════════════════════════════
console.log("━━ adoption: listing a cat ━━");
// ════════════════════════════════════════════════════════════════════════

const owner = await member("owner");
const adopter = await member("adopter");
const stranger = await member("stranger");

const cat = await newCat(owner.token, `Rehome${rnd()}`);
ok(!!cat.id && !!cat.catIdNumber, `cat registered with a Cat ID: ${cat.catIdNumber}`);

const STORY = "A gentle four-year-old who sleeps on the windowsill and hates the vacuum.";
const listing = (
  await call(
    "/adoption/listings",
    "POST",
    { catId: cat.id, story: STORY, cityCode: "riyadh", contactPref: "IN_APP" },
    owner.token
  )
).json;
ok(!!listing.id && listing.status === "AVAILABLE", "listing created and live");

ok(
  (
    await call(
      "/adoption/listings",
      "POST",
      { catId: cat.id, story: STORY },
      owner.token
    )
  ).status === 409,
  "a cat can only be listed once at a time (409)"
);
ok(
  (
    await call(
      "/adoption/listings",
      "POST",
      { catId: cat.id, story: STORY },
      stranger.token
    )
  ).status === 404,
  "you cannot list someone else's cat (404)"
);
ok(
  (await call("/adoption/listings", "POST", { catId: cat.id, story: "too short" }, owner.token))
    .status === 400,
  "a listing needs real words, not a placeholder (400)"
);

console.log("━━ adoption: the public page keeps the household private ━━");
const publicDetail = (await call(`/adoption/listings/${listing.id}`)).json;
ok(publicDetail.cat?.catIdNumber === cat.catIdNumber, "the public page shows the Cat ID that travels");
ok(publicDetail.contact === null, "no contact detail on a public read");
{
  // The privacy contract in one assertion: nothing in the whole payload may
  // contain the owner's email, and no `email`/`phone`/`userId` key may exist.
  const blob = JSON.stringify(publicDetail);
  ok(!blob.includes(owner.email), "the owner's email never appears in a public listing");
  ok(!/"(email|phone|userId|ownerId)"\s*:/.test(blob), "no email/phone/userId keys in a public listing");
}
const board = (await call("/adoption/listings")).json;
ok(
  board.items?.some((i) => i.id === listing.id),
  "the listing appears on the public board"
);
ok(
  !JSON.stringify(board).includes(owner.email),
  "the public board never carries an owner's email"
);

console.log("━━ adoption: enquiries ━━");
const MSG = "We have a quiet flat, no other pets, and I work from home most days.";
const enquiry = (
  await call(`/adoption/listings/${listing.id}/requests`, "POST", { message: MSG }, adopter.token)
).json;
ok(enquiry.status === "PENDING", "an enquiry lands as pending");
ok(
  (await call(`/adoption/listings/${listing.id}/requests`, "POST", { message: MSG }, owner.token))
    .status === 400,
  "you cannot enquire about your own cat (400)"
);
ok(
  (await call(`/adoption/listings/${listing.id}/requests`, "GET", undefined, stranger.token))
    .status === 403,
  "only the listing owner may read its enquiries (403)"
);

const enquiriesPending = (
  await call(`/adoption/listings/${listing.id}/requests`, "GET", undefined, owner.token)
).json;
ok(
  enquiriesPending.items?.[0]?.requester?.email === null,
  "a pending enquirer's email is withheld even from the owner"
);

const accepted = (
  await call(`/adoption/requests/${enquiry.id}/accept`, "POST", { note: "Come by Saturday" }, owner.token)
).json;
ok(accepted.status === "ACCEPTED", "the owner can accept an enquiry");
{
  const after = (await call(`/adoption/listings/${listing.id}`, "GET", undefined, owner.token)).json;
  ok(after.status === "RESERVED", "accepting reserves the cat rather than moving them");
  const enquiriesAccepted = (
    await call(`/adoption/listings/${listing.id}/requests`, "GET", undefined, owner.token)
  ).json;
  ok(
    enquiriesAccepted.items?.[0]?.requester?.email === adopter.email,
    "the adopter's email is released only after they're accepted"
  );
}

// ════════════════════════════════════════════════════════════════════════
console.log("━━ ownership transfer: the two confirmations ━━");
// ════════════════════════════════════════════════════════════════════════

ok(
  (
    await call(
      `/adoption/requests/${enquiry.id}/handover`,
      "POST",
      { confirmCatName: "Definitely Not The Cat" },
      owner.token
    )
  ).status === 400,
  "the hand-over is refused unless the owner types the cat's name (400)"
);

const handover = (
  await call(
    `/adoption/requests/${enquiry.id}/handover`,
    "POST",
    { confirmCatName: cat.name },
    owner.token
  )
).json;
ok(handover.status === "PENDING" && handover.toEmail === adopter.email, "the Cat ID transfer is sent");

const mine = (await call("/transfers", "GET", undefined, adopter.token)).json;
const incoming = mine.incoming?.find((t) => t.cat.id === cat.id);
ok(!!incoming && incoming.status === "PENDING", "the adopter sees the incoming hand-over");
ok(
  incoming?.toEmail?.includes("•"),
  "an incoming row masks the address rather than restating it in full"
);

ok(
  (await call("/transfers/accept", "POST", { token: incoming.id }, stranger.token)).status === 403,
  "someone the offer is not addressed to cannot accept it (403)"
);

console.log("━━ ownership transfer: the hand-over itself ━━");
const before = (await call(`/cats/${cat.id}`, "GET", undefined, owner.token)).json;
ok(before.id === cat.id, "the outgoing owner can still read the cat before the transfer");

const moved = (await call("/transfers/accept", "POST", { token: incoming.id }, adopter.token)).json;
ok(moved.status === "ACCEPTED", "the adopter accepts");
ok(moved.catIdNumber === cat.catIdNumber, "THE CAT ID NUMBER DOES NOT CHANGE — the whole promise");

{
  const nowMine = (await call(`/cats/${cat.id}`, "GET", undefined, adopter.token)).json;
  ok(nowMine?.id === cat.id, "the new owner can open the cat");
  ok(nowMine?.catIdNumber === cat.catIdNumber, "the new owner holds the same Cat ID");
  ok(nowMine?.catNumber === cat.catNumber, "the census ordinal survives the move");
  // The previous owner must lose ownership-level access the instant it lands.
  ok(
    (await call(`/cats/${cat.id}`, "GET", undefined, owner.token)).status === 404,
    "the PREVIOUS owner can no longer read the cat (404)"
  );
  ok(
    (await call(`/cats/${cat.id}`, "PATCH", { name: "Taken Back" }, owner.token)).status === 404,
    "the previous owner can no longer edit the cat (404)"
  );
  // Privacy fields encoded the OLD owner's consent and must not follow the cat.
  ok(nowMine?.showOwnerName !== true, "owner-name visibility resets on transfer");
}

{
  const history = (await call(`/cats/${cat.id}/ownership-history`, "GET", undefined, adopter.token)).json;
  ok(history.items?.length === 1, "provenance is appended, once");
  ok(history.items?.[0]?.reason === "ADOPTION", "provenance records why the cat moved");
  ok(
    !JSON.stringify(history).includes(owner.email),
    "provenance names people by first name, never by email"
  );
  ok(
    (await call(`/cats/${cat.id}/ownership-history`, "GET", undefined, owner.token)).status === 404,
    "the previous owner cannot read the provenance either (404)"
  );
}

{
  const settled = (await call(`/adoption/listings/${listing.id}`)).json;
  ok(settled.status === "ADOPTED", "the listing closes as adopted in the same transaction");
  ok(
    (await call("/transfers/accept", "POST", { token: incoming.id }, adopter.token)).status === 409,
    "the same hand-over cannot be accepted twice (409)"
  );
}

console.log("━━ ownership transfer: a direct hand-over, and its refusals ━━");
{
  const giver = await member("giver");
  const gift = await newCat(giver.token, `Gift${rnd()}`);
  ok(
    (
      await call(
        `/cats/${gift.id}/transfer`,
        "POST",
        { toEmail: giver.email, confirmCatName: gift.name },
        giver.token
      )
    ).status === 400,
    "you cannot hand a cat to yourself (400)"
  );
  ok(
    (
      await call(
        `/cats/${gift.id}/transfer`,
        "POST",
        { toEmail: "not-an-email", confirmCatName: gift.name },
        giver.token
      )
    ).status === 400,
    "a malformed recipient address is refused (400)"
  );
  // An offer to an address with no account yet is legitimate — that is how you
  // hand a cat to someone who hasn't joined.
  const pending = (
    await call(
      `/cats/${gift.id}/transfer`,
      "POST",
      { toEmail: `future+${rnd()}@e.com`, confirmCatName: gift.name, note: "He likes the balcony." },
      giver.token
    )
  ).json;
  ok(pending.recipientHasAccount === false, "an offer can be addressed to someone with no account");

  // Anyone can REGISTER an address they don't control. Until that email is
  // confirmed, the account must neither see nor accept the offer by its id —
  // only the emailed token (proof of the inbox) or a verified email moves a cat.
  {
    const squatEmail = `squat+${rnd()}@e.com`;
    const offer = (
      await call(
        `/cats/${gift.id}/transfer`,
        "POST",
        { toEmail: squatEmail, confirmCatName: gift.name },
        giver.token
      )
    ).json;
    const squat = (
      await call("/auth/register", "POST", {
        email: squatEmail,
        password: "S3cure!pass",
        firstName: "squat",
        acceptTerms: true,
      })
    ).json;
    const theirs = (await call("/transfers", "GET", undefined, squat.accessToken)).json;
    ok((theirs.incoming ?? []).length === 0, "an unverified account is not shown offers addressed to its email");
    ok(
      (await call(`/transfers/${offer.id}`, "GET", undefined, squat.accessToken)).status === 403,
      "an unverified account cannot preview an offer by id (403)"
    );
    const grab = await call("/transfers/accept", "POST", { token: offer.id }, squat.accessToken);
    ok(
      grab.status === 403 && grab.json?.code === "EMAIL_NOT_VERIFIED",
      "an unverified account cannot accept a cat by transfer id (403 EMAIL_NOT_VERIFIED)"
    );
    ok(
      (await call(`/cats/${gift.id}`, "GET", undefined, giver.token)).json?.id === gift.id,
      "the cat stays with its owner after the refused grab"
    );
    if (squat.devEmailCode) {
      await call("/auth/email/otp/verify", "POST", { code: squat.devEmailCode }, squat.accessToken);
      const after = (await call("/transfers", "GET", undefined, squat.accessToken)).json;
      ok((after.incoming ?? []).some((t) => t.id === offer.id), "once verified, the offer appears in their portal");
    }
    await call(`/transfers/${offer.id}/cancel`, "POST", {}, giver.token);
  }

  // Withdrawing is always available while it is pending (R010).
  const cancelled = (await call(`/transfers/${pending.id}/cancel`, "POST", {}, giver.token)).json;
  ok(cancelled.status === "CANCELLED", "the sender can withdraw the offer");
  ok(
    (await call(`/cats/${gift.id}`, "GET", undefined, giver.token)).json?.id === gift.id,
    "withdrawing leaves the cat exactly where it was"
  );
}

// ════════════════════════════════════════════════════════════════════════
console.log("━━ lost & found ━━");
// ════════════════════════════════════════════════════════════════════════

const finder = await member("finder");
const seeker = await member("seeker");
const CHIP = `9680000${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
const chipped = await newCat(seeker.token, `Chip${rnd()}`, { microchipNo: CHIP });

const lost = (
  await call(
    "/lost-found/posts",
    "POST",
    {
      kind: "LOST",
      catId: chipped.id,
      description: "Grey tabby with a white chest, very shy with strangers.",
      cityCode: "riyadh",
      district: "Al Olaya",
      happenedAt: new Date().toISOString(),
      contactPref: "IN_APP",
    },
    seeker.token
  )
).json;
ok(!!lost.id, "a lost notice is filed");
{
  const catNow = (await call(`/cats/${chipped.id}`, "GET", undefined, seeker.token)).json;
  ok(!!catNow.lostModeAt, "filing a lost notice puts the Cat ID into lost mode — one action, not two");
}

ok(
  (
    await call(
      "/lost-found/posts",
      "POST",
      { kind: "LOST", catId: chipped.id, description: "Not my cat at all", happenedAt: new Date().toISOString() },
      finder.token
    )
  ).status === 404,
  "you cannot file a lost notice naming someone else's cat (404)"
);

console.log("━━ lost & found: what a stranger may see ━━");
const lostPublic = (await call(`/lost-found/posts/${lost.id}`)).json;
ok(lostPublic.microchip?.onFile === true, "a stranger learns the cat is chipped");
ok(lostPublic.microchip?.value === null, "…but never the chip number itself");
ok(lostPublic.contact?.phone === null, "an in-app reporter publishes no phone number");
ok(!JSON.stringify(lostPublic).includes(seeker.email), "the reporter's email is never published");
{
  const asReporter = (await call(`/lost-found/posts/${lost.id}`, "GET", undefined, seeker.token)).json;
  ok(asReporter.microchip?.value === CHIP, "the reporter themselves sees the chip number they entered");
}

console.log("━━ lost & found: the relay ━━");
// Deliberately unauthenticated: a neighbour holding a cat is not a member.
const relayed = await fetch(`${base}/lost-found/posts/${lost.id}/messages`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    message: "I think I saw this cat by the mosque on King Fahd this morning.",
    senderName: "Neighbour",
    senderPhone: "0551234567",
  }),
});
ok(relayed.ok, "a signed-out neighbour can message the reporter");
{
  const msgs = (await call(`/lost-found/posts/${lost.id}/messages`, "GET", undefined, seeker.token)).json;
  ok(msgs.items?.length === 1, "the message reaches the reporter");
  ok(msgs.items?.[0]?.phone === "+966551234567", "the sender's own number is passed on, normalised");
  ok(
    (await call(`/lost-found/posts/${lost.id}/messages`, "GET", undefined, finder.token)).status === 403,
    "nobody else can read a notice's messages (403)"
  );
}

console.log("━━ lost & found: the chip match ━━");
const found = (
  await call(
    "/lost-found/posts",
    "POST",
    {
      kind: "FOUND",
      description: "Found a friendly grey cat near the park, scanned at a clinic.",
      microchipNo: CHIP,
      cityCode: "riyadh",
      happenedAt: new Date().toISOString(),
    },
    finder.token
  )
).json;
ok(!!found.id, "a found notice is filed");
{
  // The chip notification is fire-and-forget; give it a beat. The stable
  // message key lives under data.type — the columns hold the rendered copy.
  let matched = false;
  for (let i = 0; i < 10 && !matched; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const notes = (await call("/account/notifications", "GET", undefined, seeker.token)).json;
    const items = Array.isArray(notes) ? notes : (notes.items ?? []);
    matched = items.some((n) => n.data?.type === "lost_found_possible_match");
  }
  ok(matched, "an EXACT chip match notifies the registered cat's owner");
}
{
  const byChip = (await call(`/lost-found/posts?search=${CHIP}&kind=FOUND`)).json;
  ok(byChip.items?.some((i) => i.id === found.id), "a chip number is an exact, public search");
}

console.log("━━ lost & found: the reunion ━━");
const reunited = (
  await call(`/lost-found/posts/${lost.id}/status`, "POST", { status: "REUNITED" }, seeker.token)
).json;
ok(reunited.status === "REUNITED", "the reporter marks the cat home");
{
  const catNow = (await call(`/cats/${chipped.id}`, "GET", undefined, seeker.token)).json;
  ok(!catNow.lostModeAt, "marking them home also switches the Cat ID out of lost mode");
  const facets = (await call("/lost-found/facets")).json;
  ok(facets.reunited >= 1, "the reunited count is earned from real rows");
  ok(
    (await call(`/lost-found/posts/${lost.id}/status`, "POST", { status: "CLOSED" }, finder.token))
      .status === 403,
    "only the reporter can change a notice's status (403)"
  );
}

// ════════════════════════════════════════════════════════════════════════
console.log("━━ “I don't have a cat yet” ━━");
// ════════════════════════════════════════════════════════════════════════
{
  const catless = await member("catless");
  const set = (await call("/account/no-cat-yet", "POST", { value: true }, catless.token)).json;
  ok(set.noCatYet === true, "a member can join without a cat, deliberately");
  const overview = (await call("/account/overview", "GET", undefined, catless.token)).json;
  ok(overview.owner?.noCatYet === true, "the portal is told to show the explore home");

  // Registering a cat must clear it without anyone having to remember to.
  await newCat(catless.token, `First${rnd()}`);
  const after = (await call("/account/overview", "GET", undefined, catless.token)).json;
  ok(after.owner?.noCatYet !== true, "registering the first cat clears the flag automatically");

  // And the flag can never be a lie: a member WITH a cat cannot set it.
  const relapse = (await call("/account/no-cat-yet", "POST", { value: true }, catless.token)).json;
  ok(relapse.noCatYet === false, "a member who has a cat cannot claim to have none");
}

// ════════════════════════════════════════════════════════════════════════
console.log("━━ moderation: staff can take a public post down ━━");
// ════════════════════════════════════════════════════════════════════════
//
// Both new boards are member-authored and public, so the question that decides
// whether they may BE public is: can a staff member take something down, and
// does the person who wrote it find out? A hidden column nobody can set is not
// moderation.
{
  const admin = (
    await call("/auth/login", "POST", { email: "admin@moraqat.sa", password: "Admin!2026" })
  ).json;
  if (!admin?.accessToken) {
    console.log("  ⓘ skipped: seeded admin not present in this database");
  } else {
    const A = admin.accessToken;
    ok(
      (await call("/admin/lost-found/posts", "GET", undefined, finder.token)).status === 403,
      "a member cannot open the moderation queue (403)"
    );

    const queue = (await call("/admin/lost-found/posts?filter=live", "GET", undefined, A)).json;
    ok(
      queue.items?.some((i) => i.id === found.id),
      "a live notice appears in the moderation queue"
    );
    ok(
      queue.items?.some((i) => i.contactPref),
      "the queue surfaces the contact posture — the field most likely to need judgement"
    );

    const hidden = (
      await call(`/admin/lost-found/posts/${found.id}/hide`, "PATCH", { reason: "Duplicate post" }, A)
    ).json;
    ok(hidden.hidden === true, "staff can hide a notice");
    ok(
      (await call(`/lost-found/posts/${found.id}`)).status === 404,
      "a hidden notice is gone from the public board (404)"
    );

    // The author must hear what happened — a silent disappearance is the thing
    // this product does not do (R006/R084).
    let told = false;
    for (let i = 0; i < 10 && !told; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const notes = (await call("/account/notifications", "GET", undefined, finder.token)).json;
      const items = Array.isArray(notes) ? notes : (notes.items ?? []);
      told = items.some((n) => n.data?.type === "listing_hidden");
    }
    ok(told, "the author is told their post was hidden, and why");

    const restored = (await call(`/admin/lost-found/posts/${found.id}/unhide`, "PATCH", {}, A)).json;
    ok(restored.hidden === false, "staff can restore it again");
    ok(
      (await call(`/lost-found/posts/${found.id}`)).status === 200,
      "a restored notice is public once more"
    );

    // Same for the adoption board.
    const adminListings = (await call("/admin/adoption/listings?filter=settled", "GET", undefined, A)).json;
    ok(
      adminListings.items?.some((i) => i.id === listing.id),
      "a completed adoption is reviewable under the settled filter"
    );
  }
}

// ════════════════════════════════════════════════════════════════════════
console.log("━━ the vet demo is staff-only and quarantined ━━");
// ════════════════════════════════════════════════════════════════════════
{
  ok(
    (await call("/admin/vet-demo", "GET", undefined, owner.token)).status === 403,
    "a member cannot reach the vet demo (403)"
  );
  ok((await call("/admin/vet-demo/enter", "POST", {})).status === 401, "and it needs auth at all (401)");

  const admin = (
    await call("/auth/login", "POST", { email: "admin@moraqat.sa", password: "Admin!2026" })
  ).json;
  if (!admin?.accessToken) {
    console.log("  ⓘ skipped: seeded admin not present in this database");
  } else {
    // The button must answer fast enough for a browser. Every client call is
    // capped at 10s, and the first version did the whole provision inline —
    // ~60 sequential round trips plus two bcrypt cost-12 hashes — so it timed
    // out in production while the server carried on working. Entering now does
    // only the clinic + this admin's membership; the rest fills in behind it.
    const enterStarted = Date.now();
    const entered = (await call("/admin/vet-demo/enter", "POST", {}, admin.accessToken)).json;
    const enterMs = Date.now() - enterStarted;
    ok(entered.isDemo === true && !!entered.orgId, "an admin can enter the demo clinic");
    ok(enterMs < 5_000, `entering answers well inside the browser's budget (${enterMs}ms)`);
    ok(typeof entered.ready === "boolean", "entering says whether the demo is already furnished");
    ok(entered.credentials?.accounts?.length >= 3, "the demo hands back its own logins for a walkthrough");

    // Whatever `ready` said, the demo must converge — this is the poll the
    // admin card runs, with the same cap.
    let furnished = entered.ready;
    for (let i = 0; i < 20 && !furnished; i++) {
      await new Promise((r) => setTimeout(r, 1_000));
      furnished = (await call("/admin/vet-demo", "GET", undefined, admin.accessToken)).json?.ready;
    }
    ok(furnished === true, "the background fill finishes and the demo reports itself ready");

    // Readiness must mean the CURATED demo is there, not merely that some demo
    // cat exists — a walk-in created at the counter must not satisfy it.
    const demoState = (await call("/admin/vet-demo", "GET", undefined, admin.accessToken)).json;
    ok((demoState.staff ?? 0) >= 5, "the five demo staff exist once the fill is done");

    const ctx = (await call("/vet/auth/context", "POST", {}, admin.accessToken)).json;
    const demoOrg = ctx.memberships?.find((m) => m.org.id === entered.orgId);
    ok(!!demoOrg && demoOrg.status === "ACTIVE", "the admin is genuinely clinic staff, not a bypass");
    ok(demoOrg?.org?.isDemo === true, "the portal is told the clinic is a demo, so it can say so");

    // THE quarantine assertion: a demo clinic must not resolve a real cat.
    // `cat` here is a real member's cat, and it has a Cat ID.
    const search = await call(
      `/vet/patients/search?q=${encodeURIComponent(cat.catIdNumber)}`,
      "GET",
      undefined,
      admin.accessToken,
      { "x-moracat-org": entered.orgId }
    );
    const hits = search.json?.results ?? search.json?.items ?? [];
    ok(
      search.status !== 200 || !JSON.stringify(hits).includes(cat.catIdNumber),
      "a demo clinic CANNOT find a real member's cat — the quarantine holds"
    );

    const left = (await call("/admin/vet-demo/leave", "POST", {}, admin.accessToken)).json;
    ok(left.left === true, "the admin can leave the demo again");
    const after = (await call("/admin/vet-demo", "GET", undefined, admin.accessToken)).json;
    ok(after.inside === false, "leaving actually offboards the demo membership");
  }
}

console.log(
  fail === 0
    ? `\n✅ CAT-LIFE PASS: ${pass} passed, 0 failed`
    : `\n❌ CAT-LIFE FAILURES: ${pass} passed, ${fail} failed`
);
process.exit(fail === 0 ? 0 : 1);
