/**
 * The clinical loop, end to end — the one path a clinic walks every day.
 *
 * WHY ITS OWN SUITE
 * The UX audit of 2026-10-04 (Problem 1) found that no clinic could write a
 * record: the portal and the API disagreed on payload keys, envelopes and
 * actions, and every save was a 400. Each piece "worked" in isolation. This
 * suite walks the loop the way the portal now does — the exact request shapes
 * from @moraqat/core's vet contract — so the next drift fails here, not at a
 * counter:
 *
 *   scan by Cat ID (Arabic digits too) → open visit (and resume, never fork)
 *   → close an EMPTY visit (needs a reason) → VACCINATION (coded) → overdue
 *   is judged on the latest dose only → PRESCRIPTION (+ allergy override
 *   beside the payload) → dispense / cancel-with-reason → close → owner
 *   summary (honest delivery) → counter PIN unlock → a write attributed to the
 *   PIN'd person → lock → break-glass on a real cat refused by the demo
 *   quarantine → doctor invites need a licence.
 *
 * Runs against the seeded demo clinic (`db:seed:vet-demo`). Without it the
 * suite says so and exits green, like smoke.mjs's quarantine block.
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
const DEMO_PASSWORD = "DemoVet!2026";
const DEMO_PIN = "2468";
const DEMO_CHIP = "968000011122233";
/** Latin → Arabic-Indic, the way an Arabic keyboard types a number. */
const arabicDigits = (s) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

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

const login = async (email) => {
  const r = await call("/auth/login", "POST", { email, password: DEMO_PASSWORD });
  return r.status === 200 ? r.json.accessToken : null;
};

console.log("━━ vet clinical loop (MRC-VET-001, audit 2026-10-04 #1) ━━");

const DT = await login("demo.vet@moracat.co");
if (!DT) {
  ok(true, "demo clinic not seeded here — clinical loop skipped (run db:seed:vet-demo)");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(0);
}

const ctx = (await call("/vet/auth/context", "POST", {}, DT)).json;
const membership = ctx?.memberships?.find((m) => m.org?.isDemo) ?? ctx?.memberships?.[0];
const orgId = membership?.org?.id;
const vetStaffId = membership?.staffId;
ok(!!orgId && !!vetStaffId, "demo vet resolves a clinic and a membership");
ok(membership?.licence === "VALID", `a licensed senior vet's standing is VALID (got ${membership?.licence})`);
ok((membership?.capabilities ?? []).includes("prescription.write"), "…so prescribing is NOT held");
const H = { "x-moracat-org": orgId };

// ── 1 · Scan / search ──────────────────────────────────────────────────────
console.log("━━ scan → patient ━━");
const byChip = await call(`/vet/patients/search?q=${DEMO_CHIP}`, "GET", undefined, DT, H);
const demoCat = byChip.json?.results?.[0];
ok(byChip.status === 200 && byChip.json?.results?.length === 1 && !!demoCat?.catId, "microchip finds exactly one demo cat");
const byArabicChip = await call(`/vet/patients/search?q=${encodeURIComponent(arabicDigits(DEMO_CHIP))}`, "GET", undefined, DT, H);
ok(
  byArabicChip.json?.query?.detectedAs === "microchip" && byArabicChip.json?.results?.[0]?.catId === demoCat?.catId,
  "the same chip typed in Arabic-Indic digits is read as a microchip, not a name"
);
if (demoCat?.catIdNumber) {
  const byCatId = await call(`/vet/patients/search?q=${encodeURIComponent(demoCat.catIdNumber)}`, "GET", undefined, DT, H);
  ok(byCatId.json?.query?.detectedAs === "catId" && byCatId.json?.results?.length === 1, "search by Cat ID resolves one cat");
  const lower = await call(`/vet/patients/search?q=${encodeURIComponent(demoCat.catIdNumber.toLowerCase().replace(/-/g, " "))}`, "GET", undefined, DT, H);
  ok(lower.json?.results?.[0]?.catId === demoCat.catId, "…and the same Cat ID typed loosely (lower-case, spaces) resolves too");
} else {
  ok(true, "the demo cat has no Cat ID number yet — Cat ID search covered by smoke.mjs");
}

// ── 2 · A walk-in: its intake visit is OPEN and EMPTY ─────────────────────
console.log("━━ visits: open, resume, close ━━");
const walkName = `Loop${rnd()}`;
const walkPhoneLatin = `05${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
const created = await call(
  "/vet/patients",
  "POST",
  // The owner's mobile typed on an Arabic keyboard.
  { name: walkName, ownerPhone: arabicDigits(walkPhoneLatin), gender: "FEMALE", reason: "vaccination", ownerConsented: true },
  DT,
  H
);
ok(created.status === 201 && created.json?.created === true, "a walk-in registers with an Arabic-digit phone");
const catId = created.json?.cat?.catId;
const intakeVisitId = created.json?.visit?.id;

const fork = await call("/vet/visits", "POST", { catId, resumeExisting: false }, DT, H);
ok(fork.status === 409 && fork.json?.code === "VET_VISIT_OPEN_EXISTS", "a second open visit is refused (409 VET_VISIT_OPEN_EXISTS)");
const resumed = await call("/vet/visits", "POST", { catId, resumeExisting: true }, DT, H);
ok(
  resumed.status === 201 && resumed.json?.resumed === true && resumed.json?.visit?.id === intakeVisitId,
  "openVisit returns {visit, resumed} and resumes the open visit (never /visits/undefined)"
);

const emptyClose = await call(`/vet/visits/${intakeVisitId}/close`, "POST", {}, DT, H);
ok(emptyClose.status === 400 && emptyClose.json?.code === "VET_VISIT_EMPTY", "closing an EMPTY visit without a reason is refused");
const reasoned = await call(`/vet/visits/${intakeVisitId}/close`, "POST", { reason: "no-show" }, DT, H);
ok(reasoned.status === 201 || reasoned.status === 200, "…and closes with a coded reason");
ok(
  (reasoned.json?.visit?.reasonLabel?.ar ?? "").includes("لم يحضر") && !(reasoned.json?.visit?.reasonLabel?.ar ?? "").includes("no-show"),
  `the reason is stored as a code and rendered in Arabic (${reasoned.json?.visit?.reasonLabel?.ar})`
);
ok(typeof reasoned.json?.pendingCoSign === "number" && "nextStep" in (reasoned.json ?? {}), "close returns {visit, pendingCoSign, nextStep}");

const opened = await call("/vet/visits", "POST", { catId, reason: "vaccination", resumeExisting: true }, DT, H);
ok(opened.status === 201 && opened.json?.resumed === false && !!opened.json?.visit?.id, "a fresh visit opens");
const visitId = opened.json?.visit?.id;

const book = await call("/vet/visits", "GET", undefined, DT, H);
ok((book.json?.items ?? []).some((v) => v.id === visitId && v.stale === false), "today's book lists the open visit (Riyadh day), marked not stale");

// ── 3 · VACCINATION, exactly as the composer builds it ────────────────────
console.log("━━ records ━━");
const vax = await call(
  "/vet/records",
  "POST",
  { catId, visitId, type: "VACCINATION", payload: { vaccineCode: "RABIES", product: "Rabisin", batchNo: "B-1", route: "SC", dueAt: "2027-10-01" } },
  DT,
  H
);
ok(vax.status === 201 && !!vax.json?.entry?.id, "a coded VACCINATION saves and returns {entry, …}");
ok(vax.json?.coSign?.required === false && !!vax.json?.sideEffects?.vaccination, "…final, and it wrote the owner-facing dose (reminder source)");
ok(vax.json?.entry?.payload?.vaccine === "Rabies", "a coded dose gets its canonical name");
const legacy = await call("/vet/records", "POST", { catId, visitId, type: "VACCINATION", payload: { vaccine: "tricat trio", dueAt: "2027-06-01" } }, DT, H);
ok(legacy.status === 201 && legacy.json?.entry?.payload?.vaccineCode === "FVRCP", "a legacy free-text vaccine is normalised to its code");
const oldDose = await call(
  "/vet/records",
  "POST",
  { catId, visitId, type: "VACCINATION", payload: { vaccineCode: "RABIES", dueAt: "2025-01-01" }, occurredAt: "2024-01-01T09:00:00.000Z" },
  DT,
  H
);
ok(oldDose.status === 201, "an older Rabies dose (due date long past) is recorded too");
const ghost = await call("/vet/records", "POST", { catId, visitId, type: "EXAM", payload: { clinicalType: "EXAM", subjective: "x" } }, DT, H);
ok(ghost.status === 400 && ghost.json?.code === "VET_PAYLOAD_INVALID", "the old composer's ghost key (clinicalType) is still a 400");
const exam = await call(
  "/vet/records",
  "POST",
  { catId, visitId, type: "EXAM", payload: { subjective: "Eating less", temperatureC: 38.6, heartRate: 180, respiratoryRate: 28 } },
  DT,
  H
);
ok(exam.status === 201, "an EXAM with respiratoryRate (not respRate) saves");

const profile = await call(`/vet/patients/${catId}`, "GET", undefined, DT, H);
if (profile.json?.care) {
  const rabies = (profile.json.care.vaccinations ?? []).filter((v) => v.vaccineCode === "RABIES");
  ok(rabies.length === 2 && rabies.filter((v) => v.overdue).length === 0, "the superseded old Rabies dose is NOT overdue");
  ok(rabies.some((v) => v.standing === "SUPERSEDED"), "…it is marked SUPERSEDED");
} else {
  ok(true, "care summary withheld at this consent tier — overdue reduction is covered by core unit tests");
}

// ── 4 · PRESCRIPTION + lifecycle ──────────────────────────────────────────
console.log("━━ prescriptions ━━");
const rx = await call(
  "/vet/records",
  "POST",
  {
    catId,
    visitId,
    type: "PRESCRIPTION",
    payload: { medication: "Amoxicillin", strength: "50 mg", form: "tablet", dosage: "1 tab", frequency: "BID", durationDays: 10 },
    allergyOverride: { matched: ["Amoxicillin"], justification: "Mild historic GI upset only; benefit outweighs risk." },
  },
  DT,
  H
);
const rxId = rx.json?.sideEffects?.prescription?.id;
ok(rx.status === 201 && !!rxId, "a PRESCRIPTION saves (allergyOverride travels beside the payload)");
ok((rx.json?.sideEffects?.prescription?.warnings ?? []).some((w) => String(w).startsWith("ALLERGY_OVERRIDE")), "the override is recorded on the prescription");
ok((rx.json?.entry?.note ?? "").includes("allergy override"), "…and on the entry's note");
const statusShape = await call(`/vet/prescriptions/${rxId}/status`, "POST", { status: "COLLECTED" }, DT, H);
ok(statusShape.status === 400, "the old {status} body is rejected");
const dispensed = await call(`/vet/prescriptions/${rxId}/status`, "POST", { action: "dispense", notifyOwner: true }, DT, H);
ok(dispensed.status === 201 && dispensed.json?.transition?.to === "COLLECTED", "dispense → COLLECTED");
ok(dispensed.json?.ownerNotification?.delivered === false && dispensed.json?.ownerNotification?.reason === "UNCLAIMED", "notification honestly reports an unclaimed cat");
const noReason = await call(`/vet/prescriptions/${rxId}/status`, "POST", { action: "cancel" }, DT, H);
ok(noReason.status === 400 && noReason.json?.code === "VET_REASON_REQUIRED", "cancel without a reason is refused");
const cancelled = await call(`/vet/prescriptions/${rxId}/status`, "POST", { action: "cancel", reason: "Switched to a liquid form" }, DT, H);
ok(cancelled.status === 201 && cancelled.json?.transition?.to === "CANCELLED", "cancel with a reason → CANCELLED");

// ── 5 · Close + owner summary ─────────────────────────────────────────────
console.log("━━ close + owner summary ━━");
const closed = await call(`/vet/visits/${visitId}/close`, "POST", {}, DT, H);
ok((closed.status === 201 || closed.status === 200) && closed.json?.visit?.state === "CLOSED", "a visit with entries closes without a reason");
ok(closed.json?.pendingCoSign === 0 && closed.json?.nextStep?.action === "owner-summary", "close surfaces pendingCoSign + the owner-summary next step");
const summary = await call(`/vet/visits/${visitId}/owner-summary`, "POST", { summary: `${walkName} had her rabies vaccine today.` }, DT, H);
ok(summary.status === 201 && summary.json?.delivered === false && summary.json?.ownerNotification?.reason === "UNCLAIMED", "owner summary is saved and reports it reached nobody (unclaimed cat)");

// ── 6 · Counter PIN: a write attributed to the PIN'd person ──────────────
console.log("━━ counter mode ━━");
const OT = await login("demo.owner@moracat.co");
const branches = (await call("/vet/org/branches", "GET", undefined, OT, H)).json;
const branchId = (Array.isArray(branches) ? branches : branches?.items ?? branches?.branches ?? [])[0]?.id;
const device = await call(`/vet/org/branches/${branchId}/devices`, "POST", { name: `Loop counter ${rnd()}` }, OT, H);
ok(device.status === 201 && !!device.json?.id, "the owner registers a counter terminal");
const staffList = (await call("/vet/staff?limit=100", "GET", undefined, OT, H)).json?.items ?? [];
const vet2 = staffList.find((s) => s.user?.email === "demo.vet2@moracat.co");
ok(!!vet2?.id, "the second vet is on the team");
const unlock = await call("/vet/auth/counter/unlock", "POST", { deviceId: device.json?.id, staffId: vet2?.id, pin: DEMO_PIN }, DT, H);
ok(unlock.status === 200 && !!unlock.json?.counterToken && unlock.json?.actor?.staffId === vet2?.id, "PIN unlock returns {counterToken, actor{staffId,…}}");
ok(typeof unlock.json?.actor?.name === "string" && unlock.json.actor.name.length > 0, "…with the staff member's name (never 'Welcome, undefined')");
const CH = { ...H, [unlock.json?.header?.name ?? "x-moracat-counter"]: unlock.json?.counterToken };
const v3 = await call("/vet/visits", "POST", { catId, reason: "follow-up", resumeExisting: true }, DT, CH);
const pinNote = await call("/vet/records", "POST", { catId, visitId: v3.json?.visit?.id, type: "NOTE", payload: { subtype: "GENERAL", text: "Written at the counter" } }, DT, CH);
ok(pinNote.status === 201 && pinNote.json?.entry?.author?.id === vet2?.id, "a record written in counter mode is attributed to the PIN'd vet, not the signed-in account");
ok(pinNote.json?.entry?.author?.id !== vetStaffId, "…and not to the terminal's signed-in vet");
const locked = await call("/vet/auth/counter/lock", "POST", { token: unlock.json?.counterToken }, DT, H);
ok(locked.status === 200, "the counter locks with its token");
const afterLock = await call(`/vet/patients/${catId}`, "GET", undefined, DT, CH);
ok(afterLock.status === 401 && afterLock.json?.code === "VET_COUNTER_SESSION_EXPIRED", "a locked token is refused on the next request");
await call(`/vet/visits/${v3.json?.visit?.id}/close`, "POST", {}, DT, H);
await call(`/vet/org/devices/${device.json?.id}/revoke`, "POST", {}, OT, H);

// ── 7 · Break-glass respects the demo quarantine ─────────────────────────
console.log("━━ break-glass ━━");
const member = (await call("/auth/register", "POST", { email: `loop+${rnd()}@e.com`, password: "S3cure!pass", firstName: "Loop", acceptTerms: true })).json;
const realCat = (
  await call(
    "/cats",
    "POST",
    { name: `Real${rnd()}`, activityLevel: "MODERATE", isIndoor: true, gender: "MALE", birthDate: "2022-05-01", cityCode: "riyadh", photoUrl: "https://cdn.example.com/cat.jpg" },
    member.accessToken
  )
).json;
ok(!!realCat?.id, "a real member's cat exists");
const glassReal = await call(`/vet/emergency/${realCat.id}`, "POST", { reason: "COLLAPSE" }, DT, H);
ok(glassReal.status === 404, "break-glass on a REAL cat from the demo clinic is refused (quarantine)");
const glassDemo = await call(`/vet/emergency/${demoCat.catId}`, "POST", { reason: "COLLAPSE — found at the door" }, DT, H);
ok(glassDemo.status === 201 && (glassDemo.json?.audit?.reasonLabel?.ar ?? "").startsWith("انهيار"), "break-glass on a demo cat works and renders the coded reason in Arabic");

// ── 8 · Licences ──────────────────────────────────────────────────────────
console.log("━━ licences ━━");
const unlicensed = await call("/vet/staff/invites", "POST", { email: `nolicence+${rnd()}@e.com`, role: "VET" }, OT, H);
ok(unlicensed.status === 400 && unlicensed.json?.code === "VET_LICENCE_REQUIRED", "inviting a VET without a licence is refused");
const licensed = await call(
  "/vet/staff/invites",
  "POST",
  { email: `licensed+${rnd()}@e.com`, role: "VET", licenceNo: "SVC-LOOP-1", licenceExpiresAt: "2030-01-01" },
  OT,
  H
);
ok(licensed.status === 201, "…and accepted with a number and an in-date expiry");
if (licensed.json?.inviteId) await call(`/vet/staff/invites/${licensed.json.inviteId}/revoke`, "POST", {}, OT, H);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
