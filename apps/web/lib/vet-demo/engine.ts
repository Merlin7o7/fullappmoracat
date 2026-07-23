/**
 * The demo "backend", in the browser.
 *
 * A single `handleDemoRequest(method, path, query, body, headers)` answers every
 * route the portal calls — auth, patients, records, visits, consent, emergency —
 * returning the exact envelopes the real NestJS API sends (see `lib/vet-api.ts`
 * and `@moraqat/core`). A tiny in-memory store makes session actions real:
 * opening a visit, writing an entry, advancing a prescription, asking for
 * consent all persist until the tab is reloaded.
 *
 * Consent is enforced here, not faked: a T0 cat's record is genuinely withheld,
 * a T1 cat sees its care summary, a T2 cat sees everything — so the boundary can
 * be *demonstrated* on real screens rather than described in a slide.
 */

import { capabilitiesFor, VET_ROLE_LABELS } from "@moraqat/core";
import {
  canonicalCatIdNumber,
  canonicalSaudiPhone,
  detectVetQuery,
  extractScanToken,
  latinizeDigits,
  normalizeVetQuery,
} from "@/lib/vet-api";
import {
  ORG,
  BRANCHES,
  DEFAULT_STAFF_ID,
  DEMO_PASSWORD,
  DEMO_PIN,
  CATS,
  catById,
  staffById,
  staffByEmail,
  staffName,
  maskPhone,
  tier0Alerts,
  vaccinations,
  weightSeries,
  basePrescriptions,
  baseTimeline,
  accessLog,
  ago,
  agoMin,
  ahead,
  type DemoCat,
  type DemoStaff,
} from "./data";

export interface DemoResult {
  status: number;
  body: unknown;
}

const ok = (body: unknown): DemoResult => ({ status: 200, body });
const created = (body: unknown): DemoResult => ({ status: 201, body });
const fail = (status: number, code: string, message: string): DemoResult => ({ status, body: { code, message } });

/* ────────────────────────────────────────────────────────────────────────────
 * Session store — reset on reload. Mutations feel real within a visit.
 * ──────────────────────────────────────────────────────────────────────────*/

interface StoreVisit {
  id: string;
  catId: string;
  state: "OPEN" | "CLOSED";
  reason: string | null;
  presentingComplaint: string | null;
  branchId: string;
  openedBy: { id: string; name: string; role: string } | null;
  closedBy: { id: string; name: string; role: string } | null;
  checkedInAt: string;
  closedAt: string | null;
  ownerSummary: string | null;
  summarySentAt: string | null;
  entryIds: string[];
}

interface StoreEntry {
  id: string;
  catId: string;
  visitId: string | null;
  kind: string;
  at: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string | null;
  bodyAr: string | null;
  status: string;
  authorName: string;
  authorRole: string;
}

interface Store {
  visits: StoreVisit[];
  entries: StoreEntry[];
  rxStatus: Record<string, string>;
}

let store: Store | null = null;

function initStore(): Store {
  return {
    visits: [
      {
        id: "demo-visit-open",
        catId: "demo-cat-mishmish",
        state: "OPEN",
        reason: "Recheck — scratching returned",
        presentingComplaint: "Owner reports scratching resumed after a chicken treat",
        branchId: "demo-branch-main",
        openedBy: { id: "demo-staff-reception", name: "Sara Al-Mutairi", role: "RECEPTION" },
        closedBy: null,
        checkedInAt: agoMin(8),
        closedAt: null,
        ownerSummary: null,
        summarySentAt: null,
        entryIds: [],
      },
      {
        id: "demo-visit-closed",
        catId: "demo-cat-mishmish",
        state: "CLOSED",
        reason: "Annual check-up + booster",
        presentingComplaint: "Routine; owner reports mild scratching",
        branchId: "demo-branch-main",
        openedBy: { id: "demo-staff-vet-senior", name: "Dr. Faisal Al-Qahtani", role: "VET_SENIOR" },
        closedBy: { id: "demo-staff-vet-senior", name: "Dr. Faisal Al-Qahtani", role: "VET_SENIOR" },
        checkedInAt: ago(210),
        closedAt: ago(210),
        ownerSummary:
          "مشمش بصحة جيدة. أعطيناه جرعة التطعيم السنوية، ولاحظنا حكة خفيفة — راقبي الجلد وراجعينا لو زادت.",
        summarySentAt: ago(210),
        entryIds: ["tl-mishmish-exam", "tl-mishmish-vax1", "tl-mishmish-vax2"],
      },
    ],
    entries: [],
    rxStatus: {},
  };
}

function db(): Store {
  if (!store) store = initStore();
  return store;
}

/** Wipe the session — the demo ribbon's "Reset" calls this. */
export function resetDemoStore(): void {
  store = initStore();
}

/* ────────────────────────────────────────────────────────────────────────────
 * Who is acting — resolved from the bearer token `demo:<staffId>`.
 * ──────────────────────────────────────────────────────────────────────────*/

function actorFrom(headers: Record<string, string>): DemoStaff {
  const auth = headers["authorization"] ?? headers["Authorization"] ?? "";
  const m = /^Bearer\s+demo:(.+)$/i.exec(auth.trim());
  return staffById(m ? m[1] : DEFAULT_STAFF_ID);
}

function canRead(staff: DemoStaff): boolean {
  return capabilitiesFor({ role: staff.role }).includes("record.read");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Envelope builders
 * ──────────────────────────────────────────────────────────────────────────*/

function paginated<T>(items: T[]) {
  return {
    items,
    pagination: { page: 1, limit: Math.max(items.length, 20), total: items.length, totalPages: 1, hasMore: false },
  };
}

function recordList<T>(items: T[], tier: string, granted: string | null) {
  return { ...paginated(items), access: { tier, grantedAt: granted, expiresAt: null, emergencyOnly: false } };
}

function membershipFor(staff: DemoStaff) {
  return {
    staffId: staff.id,
    org: {
      id: ORG.id,
      slug: ORG.slug,
      nameEn: ORG.nameEn,
      nameAr: ORG.nameAr,
      logoUrl: null,
      status: "LIVE",
      verified: true,
      suspended: false,
    },
    role: staff.role,
    roleLabel: VET_ROLE_LABELS[staff.role],
    status: "ACTIVE",
    title: staff.title,
    joinedAt: ago(120),
    hasCounterPin: true,
    branches: BRANCHES,
    capabilities: capabilitiesFor({ role: staff.role }),
  };
}

function ownerContact(cat: DemoCat) {
  return {
    firstName: cat.owner.firstName,
    maskedPhone: maskPhone(cat.owner.phone),
    phone: cat.owner.phone,
    emergencyContactName: cat.owner.emergencyContactName ?? null,
    emergencyContactPhone: cat.owner.emergencyContactPhone ?? null,
  };
}

function membershipStanding(cat: DemoCat) {
  return {
    state: "ACTIVE",
    memberSince: ago(cat.memberSinceDaysAgo),
    benefitLabelEn: "15% member rate",
    benefitLabelAr: "خصم ١٥٪ للعضو",
    discountPercent: 15,
    verifiedAt: new Date().toISOString(),
    offline: false,
  };
}

function profileFor(cat: DemoCat) {
  const grantedAt = cat.tier === "T0" ? null : ago(60);
  return {
    catId: cat.id,
    name: cat.name,
    catIdNumber: cat.catIdNumber,
    photoUrl: null,
    breedEn: cat.breedEn,
    breedAr: cat.breedAr,
    sex: cat.sex,
    sterilised: cat.sterilised,
    birthDate: ago(cat.birthDaysAgo),
    ageMonths: cat.ageMonths,
    weightKg: cat.weightKg,
    microchip: cat.microchip,
    membership: membershipStanding(cat),
    owner: ownerContact(cat),
    alerts: tier0Alerts(cat.id),
    consentTier: cat.tier,
    restrictedByOwner: cat.restrictedByOwner,
    isOwnPatient: true,
    lastVisitAt: cat.lastVisitDaysAgo == null ? null : ago(cat.lastVisitDaysAgo),
    insuranceFlag: false,
    vaccinations: vaccinations(cat),
    weights: weightSeries(cat).map((p) => ({ at: p.at, kg: p.kg, source: p.source })),
    grantedAt,
  };
}

function timelineFor(cat: DemoCat) {
  const extra = db().entries.filter((e) => e.catId === cat.id);
  const base = baseTimeline(cat);
  const merged = [...base, ...extra].map((e) => ({
    id: e.id,
    kind: e.kind,
    at: e.at,
    titleEn: e.titleEn,
    titleAr: e.titleAr,
    bodyEn: e.bodyEn ?? null,
    bodyAr: e.bodyAr ?? null,
    status: e.status,
    authorName: e.authorName,
    authorRole: e.authorRole,
    orgId: ORG.id,
    orgNameEn: ORG.nameEn,
    orgNameAr: ORG.nameAr,
    attachments: [],
  }));
  return merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function prescriptionsFor(cat: DemoCat) {
  return basePrescriptions(cat).map((rx) => ({ ...rx, status: db().rxStatus[rx.id] ?? rx.status }));
}

function weightsResponse(cat: DemoCat) {
  const series = weightSeries(cat).map((p) => ({ at: p.at, kg: p.kg, source: p.source }));
  const first = series[0];
  const last = series[series.length - 1];
  const deltaKg = first && last ? +(last.kg - first.kg).toFixed(2) : 0;
  const pct = first && first.kg ? (deltaKg / first.kg) * 100 : 0;
  const direction = pct > 0.5 ? "UP" : pct < -0.5 ? "DOWN" : "STABLE";
  const trend =
    series.length < 2
      ? null
      : {
          en: `${direction === "UP" ? "Up" : direction === "DOWN" ? "Down" : "Stable"} ${Math.abs(pct).toFixed(1)}%`,
          ar: `${direction === "UP" ? "ارتفاع" : direction === "DOWN" ? "انخفاض" : "مستقر"} ${Math.abs(pct).toFixed(1)}٪`,
          direction,
          deltaKg,
        };
  return {
    catId: cat.id,
    catName: cat.name,
    currentWeightKg: last ? last.kg : null,
    windowMonths: 12,
    series,
    trend,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Finding a cat (the omnibox / scanner)
 * ──────────────────────────────────────────────────────────────────────────*/

function findCats(raw: string): DemoCat[] {
  const q = normalizeVetQuery(raw);
  const type = detectVetQuery(q);

  if (type === "qr") {
    const token = extractScanToken(q);
    const cid = canonicalCatIdNumber(token);
    if (cid) return CATS.filter((c) => c.catIdNumber === cid);
    const t = token.trim().toUpperCase();
    return CATS.filter((c) => c.catIdNumber.toUpperCase() === t || c.id.toUpperCase() === t);
  }

  const cid = canonicalCatIdNumber(q);
  if (cid) return CATS.filter((c) => c.catIdNumber === cid);

  const phone = canonicalSaudiPhone(q);
  if (phone) return CATS.filter((c) => c.owner.phone === phone);

  const digits = latinizeDigits(q).replace(/\D/g, "");
  if (/^\d{15}$/.test(digits)) return CATS.filter((c) => c.microchip === digits);

  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return CATS.filter(
    (c) =>
      c.nameEn.toLowerCase().includes(needle) ||
      c.name.includes(q.trim()) ||
      c.owner.firstName.toLowerCase().includes(needle),
  );
}

function searchResult(cat: DemoCat) {
  return {
    catId: cat.id,
    name: cat.name,
    catIdNumber: cat.catIdNumber,
    photoUrl: null,
    ownerName: cat.owner.firstName,
    lastVisitAt: cat.lastVisitDaysAgo == null ? null : ago(cat.lastVisitDaysAgo),
    isOwnPatient: true,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Visits
 * ──────────────────────────────────────────────────────────────────────────*/

function visitView(v: StoreVisit) {
  const cat = catById(v.catId)!;
  const branch = BRANCHES.find((b) => b.id === v.branchId) ?? null;
  const waitMinutes =
    v.state === "OPEN" ? Math.max(0, Math.round((Date.now() - new Date(v.checkedInAt).getTime()) / 60000)) : null;
  return {
    id: v.id,
    catId: v.catId,
    cat: { id: cat.id, name: cat.name, catIdNumber: cat.catIdNumber, photoUrl: null, membershipStatus: "ACTIVE" },
    mode: "clinic",
    state: v.state,
    reason: v.reason,
    presentingComplaint: v.presentingComplaint,
    branch: branch ? { id: branch.id, ar: branch.nameAr, en: branch.nameEn } : null,
    openedBy: v.openedBy,
    closedBy: v.closedBy,
    checkedInAt: v.checkedInAt,
    closedAt: v.closedAt,
    followUpAt: null,
    entryCount: v.entryIds.length,
    ownerSummary: v.ownerSummary,
    summarySentAt: v.summarySentAt,
    waitMinutes,
    waitLevel: v.state === "OPEN" ? (waitMinutes != null && waitMinutes >= 10 ? "amber" : "calm") : null,
  };
}

function entriesForVisit(v: StoreVisit) {
  const all = [...baseTimeline(catById(v.catId)!), ...db().entries.filter((e) => e.catId === v.catId)];
  return v.entryIds
    .map((id) => all.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      at: e.at,
      titleEn: e.titleEn,
      titleAr: e.titleAr,
      bodyEn: (e as StoreEntry).bodyEn ?? (e as { bodyEn?: string }).bodyEn ?? null,
      bodyAr: (e as StoreEntry).bodyAr ?? (e as { bodyAr?: string }).bodyAr ?? null,
      status: e.status,
      authorName: e.authorName,
      authorRole: e.authorRole,
      orgId: ORG.id,
      orgNameEn: ORG.nameEn,
      orgNameAr: ORG.nameAr,
      attachments: [],
    }));
}

/* ────────────────────────────────────────────────────────────────────────────
 * The router
 * ──────────────────────────────────────────────────────────────────────────*/

export function handleDemoRequest(
  method: string,
  path: string,
  query: URLSearchParams,
  body: Record<string, unknown>,
  headers: Record<string, string>,
): DemoResult {
  const m = method.toUpperCase();
  const staff = actorFrom(headers);

  // ── Auth ────────────────────────────────────────────────────────────────
  if (path === "/auth/login" && m === "POST") {
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    const person = staffByEmail(email);
    if (!person || (password && password !== DEMO_PASSWORD)) {
      return fail(401, "INVALID_CREDENTIALS", "Use one of the demo accounts shown below, password DemoVet!2026.");
    }
    return ok(authResponse(person));
  }
  if (path === "/auth/refresh" && m === "POST") {
    return ok({ accessToken: `demo:${staff.id}`, refreshToken: `demo:${staff.id}` });
  }
  if (path === "/auth/logout" && m === "POST") return ok({});

  // ── Vet auth / counter ────────────────────────────────────────────────────
  if (path === "/vet/auth/context" && m === "POST") {
    return ok({ memberships: [membershipFor(staff)] });
  }
  if (path === "/vet/auth/counter/unlock" && m === "POST") {
    const pin = String(body.pin ?? "");
    const targetId = String(body.staffId ?? staff.id);
    if (pin !== DEMO_PIN) return fail(401, "VET_PIN_INVALID", "The counter PIN for the demo is 2468.");
    const person = staffById(targetId);
    return ok({
      staffId: person.id,
      staffName: staffName(person),
      role: person.role,
      orgId: ORG.id,
      deviceId: String(body.deviceId ?? "demo-device"),
      deviceName: "Demo counter iPad",
      expiresAt: new Date(Date.now() + 2 * 60_000).toISOString(),
    });
  }
  if (path === "/vet/auth/counter/lock" && m === "POST") return ok({});

  // ── Public endpoints ──────────────────────────────────────────────────────
  if (path === "/vet/directory" && m === "GET") {
    return ok({
      clinics: [
        {
          orgId: ORG.id,
          nameEn: ORG.nameEn,
          nameAr: ORG.nameAr,
          city: ORG.city,
          cityAr: ORG.cityAr,
          benefitEn: "15% member rate",
          benefitAr: "خصم ١٥٪ للعضو",
          logoUrl: null,
          branches: BRANCHES.length,
          status: "LIVE",
        },
      ],
    });
  }
  if (path === "/vet/apply" && m === "POST") {
    return created({ applicationId: "demo-application", reviewDays: 3 });
  }

  // ── Patient search ────────────────────────────────────────────────────────
  if (path === "/vet/patients/search" && m === "GET") {
    const q = query.get("q") ?? "";
    const type = detectVetQuery(normalizeVetQuery(q));
    const matches = findCats(q);
    return ok({ results: matches.map(searchResult), scoped: type === "name", detectedType: type });
  }

  // ── The clinic's own patient list ─────────────────────────────────────────
  if (path === "/vet/patients" && m === "GET") {
    const q = (query.get("q") ?? "").trim().toLowerCase();
    const items = CATS.filter((c) => !q || c.nameEn.toLowerCase().includes(q) || c.name.includes(q)).map((c) => ({
      catId: c.id,
      name: c.name,
      catIdNumber: c.catIdNumber,
      photoUrl: null,
      membershipStatus: "ACTIVE",
      ownerName: c.owner.firstName,
      lastVisitAt: c.lastVisitDaysAgo == null ? null : ago(c.lastVisitDaysAgo),
      hasOpenVisit: db().visits.some((v) => v.catId === c.id && v.state === "OPEN"),
      isOwnPatient: true,
    }));
    return ok({ items, nextCursor: null, hasMore: false });
  }

  // ── One patient (and its sub-resources) ───────────────────────────────────
  const patientMatch = /^\/vet\/patients\/([^/]+)(\/(timeline|prescriptions|weights))?$/.exec(path);
  if (patientMatch && m === "GET") {
    const cat = catById(decodeURIComponent(patientMatch[1]!));
    if (!cat) return fail(404, "NOT_FOUND", "No such patient.");
    const sub = patientMatch[3];
    const granted = cat.tier === "T0" ? null : ago(60);

    if (!sub) return ok(profileFor(cat));

    // Records are consent- and role-gated. A T0 cat's record is genuinely
    // withheld; a role without record.read gets an empty, honest envelope.
    if (sub === "timeline") {
      const readable = canRead(staff) && cat.tier !== "T0";
      const hidden =
        cat.tier === "T0"
          ? [
              {
                section: "record",
                reason: {
                  code: "CONSENT_TIER_TOO_LOW",
                  ar: "لم يمنح المالك هذه العيادة الاطلاع على السجل بعد.",
                  en: "The owner hasn't granted this clinic access to the record yet.",
                },
              },
            ]
          : [];
      return ok({ ...recordList(readable ? timelineFor(cat) : [], cat.tier, granted), hiddenSections: hidden });
    }
    if (sub === "prescriptions") {
      const readable = canRead(staff) && cat.tier !== "T0";
      return ok(recordList(readable ? prescriptionsFor(cat) : [], cat.tier, granted));
    }
    if (sub === "weights") {
      const readable = canRead(staff) && cat.tier !== "T0";
      return ok(readable ? weightsResponse(cat) : { ...weightsResponse(cat), series: [], trend: null, currentWeightKg: null });
    }
  }

  // ── Visits ────────────────────────────────────────────────────────────────
  if (path === "/vet/visits" && m === "GET") {
    const date = query.get("date");
    const state = query.get("state");
    const branchId = query.get("branchId");
    const catId = query.get("catId");
    let list = db().visits.slice();
    if (branchId) list = list.filter((v) => v.branchId === branchId);
    if (catId) list = list.filter((v) => v.catId === catId);
    if (date) list = list.filter((v) => (v.state === "OPEN" ? v.checkedInAt : v.closedAt ?? v.checkedInAt).slice(0, 10) === date);
    const openNow = list.filter((v) => v.state === "OPEN").length;
    if (state) list = list.filter((v) => v.state === state);
    list = list.sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime());
    return ok({ ...paginated(list.map(visitView)), summary: { openNow } });
  }
  if (path === "/vet/visits" && m === "POST") {
    const cat = catById(String(body.catId ?? ""));
    if (!cat) return fail(404, "NOT_FOUND", "No such patient.");
    const v: StoreVisit = {
      id: `demo-visit-${Date.now().toString(36)}`,
      catId: cat.id,
      state: "OPEN",
      reason: (body.reason as string) ?? null,
      presentingComplaint: (body.reason as string) ?? null,
      branchId: (body.branchId as string) ?? "demo-branch-main",
      openedBy: { id: staff.id, name: staffName(staff), role: staff.role },
      closedBy: null,
      checkedInAt: new Date().toISOString(),
      closedAt: null,
      ownerSummary: null,
      summarySentAt: null,
      entryIds: [],
    };
    db().visits.unshift(v);
    return created(visitView(v));
  }
  const visitMatch = /^\/vet\/visits\/([^/]+)(\/(close|owner-summary))?$/.exec(path);
  if (visitMatch) {
    const v = db().visits.find((x) => x.id === decodeURIComponent(visitMatch[1]!));
    if (!v) return fail(404, "NOT_FOUND", "No such visit.");
    const action = visitMatch[3];
    if (!action && m === "GET") {
      return ok({ visit: visitView(v), entries: entriesForVisit(v), draftCount: 0 });
    }
    if (action === "close" && m === "POST") {
      v.state = "CLOSED";
      v.closedAt = new Date().toISOString();
      v.closedBy = { id: staff.id, name: staffName(staff), role: staff.role };
      return ok(visitView(v));
    }
    if (action === "owner-summary" && m === "POST") {
      v.ownerSummary = String(body.summary ?? "");
      v.summarySentAt = new Date().toISOString();
      return ok(visitView(v));
    }
  }

  // ── Clinical authorship ────────────────────────────────────────────────────
  if (path === "/vet/records" && m === "POST") {
    const cat = catById(String(body.catId ?? ""));
    if (!cat) return fail(404, "NOT_FOUND", "No such patient.");
    const kind = String(body.type ?? "NOTE");
    const note = (body.note as string) ?? "";
    const payload = (body.payload as Record<string, unknown>) ?? {};
    const title = summarize(kind, payload) || kind;
    const entry: StoreEntry = {
      id: `demo-entry-${Date.now().toString(36)}`,
      catId: cat.id,
      visitId: (body.visitId as string) ?? null,
      kind,
      at: (body.occurredAt as string) ?? new Date().toISOString(),
      titleEn: title,
      titleAr: title,
      bodyEn: note || describePayload(payload),
      bodyAr: note || describePayload(payload),
      status: staff.role === "INTERN" ? "AWAITING_COSIGN" : "FINAL",
      authorName: staffName(staff),
      authorRole: staff.title,
    };
    db().entries.push(entry);
    if (entry.visitId) {
      const v = db().visits.find((x) => x.id === entry.visitId);
      if (v) v.entryIds.push(entry.id);
    }
    return created(timelineEntryView(entry));
  }
  const recordMatch = /^\/vet\/records\/([^/]+)\/(revise|retract|cosign|attachments)$/.exec(path);
  if (recordMatch && m === "POST") {
    const id = decodeURIComponent(recordMatch[1]!);
    const action = recordMatch[2];
    const entry = db().entries.find((e) => e.id === id);
    if (action === "attachments") {
      return created({
        id: `demo-att-${Date.now().toString(36)}`,
        filename: String(body.fileName ?? "attachment"),
        mimeType: String(body.mime ?? "application/octet-stream"),
        sizeBytes: 0,
        url: (body.fileUrl as string) ?? null,
        uploadedAt: new Date().toISOString(),
      });
    }
    if (!entry) {
      // Base (seed) entries are immutable in the demo — reflect the action back
      // so the UI stays responsive without pretending to mutate fixed history.
      return ok({ id, kind: "NOTE", at: new Date().toISOString(), titleEn: "Updated", titleAr: "مُحدّث", status: action === "retract" ? "RETRACTED" : "FINAL", authorName: staffName(staff), authorRole: staff.title, orgId: ORG.id, orgNameEn: ORG.nameEn, orgNameAr: ORG.nameAr, attachments: [] });
    }
    if (action === "retract") entry.status = "RETRACTED";
    if (action === "cosign") entry.status = "FINAL";
    if (action === "revise") {
      entry.bodyEn = (body.note as string) ?? entry.bodyEn;
      entry.bodyAr = (body.note as string) ?? entry.bodyAr;
    }
    return ok(timelineEntryView(entry));
  }

  // ── Prescriptions ──────────────────────────────────────────────────────────
  const rxMatch = /^\/vet\/prescriptions\/([^/]+)\/status$/.exec(path);
  if (rxMatch && m === "POST") {
    const id = decodeURIComponent(rxMatch[1]!);
    const status = String(body.status ?? "ISSUED");
    db().rxStatus[id] = status;
    const rx = CATS.flatMap(basePrescriptions).find((r) => r.id === id);
    if (!rx) return fail(404, "NOT_FOUND", "No such prescription.");
    return ok({
      ...rx,
      status,
      dispensedByName: status === "COLLECTED" || status === "REFILLED" ? staffName(staff) : rx.dispensedByName,
      dispensedAt: status === "COLLECTED" || status === "REFILLED" ? new Date().toISOString() : rx.dispensedAt,
    });
  }

  // ── Consent, access log, org summary ───────────────────────────────────────
  if (path === "/vet/consent" && m === "GET") {
    const catId = query.get("catId");
    return ok({ grants: consentGrants(catId) });
  }
  if (path === "/vet/consent/request" && m === "POST") {
    const catId = String(body.catId ?? "");
    const cat = catById(catId);
    return created({
      id: `demo-grant-${Date.now().toString(36)}`,
      catId,
      catName: cat?.name ?? null,
      tier: String(body.tier ?? "T1"),
      scope: String(body.scope ?? "STANDING"),
      grantedAt: null,
      expiresAt: null,
      state: "PENDING",
      requestedByName: staffName(staff),
      requestedAt: new Date().toISOString(),
    });
  }
  if (path === "/vet/access-log" && m === "GET") {
    return ok({ rows: accessLog(query.get("catId") ?? undefined), nextCursor: null });
  }
  if (path === "/vet/org/summary" && m === "GET") {
    return ok(orgSummary());
  }

  // ── Emergency (break-glass) ────────────────────────────────────────────────
  if (path === "/vet/emergency" && m === "POST") {
    const identifier = String(body.identifier ?? "");
    const reason = String(body.reason ?? "");
    const matches = findCats(identifier);
    const cat = matches[0];
    if (!cat) return fail(404, "NOT_FOUND", "No cat matched that identifier.");
    return ok({
      catId: cat.id,
      name: cat.name,
      catIdNumber: cat.catIdNumber,
      photoUrl: null,
      sex: cat.sex,
      ageMonths: cat.ageMonths,
      weightKg: cat.weightKg,
      microchip: cat.microchip,
      alerts: tier0Alerts(cat.id),
      owner: ownerContact(cat),
      accessId: `demo-access-${Date.now().toString(36)}`,
      accessedAt: new Date().toISOString(),
      reason,
    });
  }

  return fail(404, "NOT_FOUND", `The demo has no handler for ${m} ${path}.`);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small helpers
 * ──────────────────────────────────────────────────────────────────────────*/

function authResponse(person: DemoStaff) {
  return {
    user: {
      id: person.id,
      email: person.email,
      firstName: person.first,
      lastName: person.last,
      locale: "ar",
      status: "ACTIVE",
      isStaff: true,
      emailVerified: true,
    },
    accessToken: `demo:${person.id}`,
    refreshToken: `demo:${person.id}`,
  };
}

function timelineEntryView(e: StoreEntry) {
  return {
    id: e.id,
    kind: e.kind,
    at: e.at,
    titleEn: e.titleEn,
    titleAr: e.titleAr,
    bodyEn: e.bodyEn,
    bodyAr: e.bodyAr,
    status: e.status,
    authorName: e.authorName,
    authorRole: e.authorRole,
    orgId: ORG.id,
    orgNameEn: ORG.nameEn,
    orgNameAr: ORG.nameAr,
    attachments: [],
  };
}

function consentGrants(catId: string | null) {
  const rows = CATS.filter((c) => c.tier !== "T0").map((c) => ({
    id: `demo-grant-${c.id}`,
    catId: c.id,
    catName: c.name,
    tier: c.tier,
    scope: "STANDING",
    grantedAt: ago(60),
    expiresAt: null,
    state: "GRANTED",
    requestedByName: null,
    requestedAt: ago(60),
  }));
  return catId ? rows.filter((r) => r.catId === catId) : rows;
}

function orgSummary() {
  return {
    orgNameEn: ORG.nameEn,
    orgNameAr: ORG.nameAr,
    orgStatus: "LIVE",
    visitsToday: { open: db().visits.filter((v) => v.state === "OPEN").length, completed: 0 },
    benefitHonouredThisMonth: { amount: 1840, visits: 12 },
    newMembersNearby: 7,
    pendingFollowUps: [
      {
        id: "fu-1",
        catId: "demo-cat-mishmish",
        catName: "مشمش",
        catPhotoUrl: null,
        dueAt: ahead(6),
        reasonEn: "Dermatitis recheck",
        reasonAr: "مراجعة التهاب الجلد",
        assignedStaffName: "Dr. Noura Al-Dossari",
      },
    ],
    vaccinationsDue: [
      {
        catId: "demo-cat-mishmish",
        catName: "مشمش",
        catPhotoUrl: null,
        vaccineEn: "Rabies",
        vaccineAr: "السعار",
        dueAt: ahead(20),
        ownerName: "Hessa",
      },
    ],
    attention: [
      {
        id: "att-1",
        severity: "INFO",
        titleEn: "One veterinarian licence renews in 40 days",
        titleAr: "رخصة طبيب واحدة تُجدَّد خلال ٤٠ يوماً",
        href: null,
        actionEn: null,
        actionAr: null,
      },
    ],
  };
}

/** A short human title for a freshly authored entry. */
function summarize(kind: string, payload: Record<string, unknown>): string {
  const p = payload as Record<string, string | number | undefined>;
  switch (kind) {
    case "VACCINATION":
      return p.vaccine ? String(p.vaccine) : "Vaccination";
    case "WEIGHT":
      return p.weightKg != null ? `Weight ${p.weightKg} kg` : "Weight";
    case "DIAGNOSIS":
      return p.condition ? String(p.condition) : "Diagnosis";
    case "PRESCRIPTION":
      return p.medication ? String(p.medication) : "Prescription";
    default:
      return "";
  }
}

function describePayload(payload: Record<string, unknown>): string | null {
  const entries = Object.entries(payload).filter(([k, v]) => k !== "clinicalType" && v != null && v !== "");
  if (!entries.length) return null;
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
}
