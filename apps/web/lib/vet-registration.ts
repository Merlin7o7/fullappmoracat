/**
 * Clinic registration — the web side of MRC-VET-002.
 *
 * Every type here mirrors a response built in
 * `apps/api/src/vet/vet-registration.service.ts` FIELD FOR FIELD (the lesson of
 * lib/vet-wire.ts: hand-imagined response types are how the vet portal once
 * failed to match its own API). If the service changes shape, change it here in
 * the same commit.
 *
 * Three callers share this file:
 *   • admin   — /admin/partners (invite, review, approve)
 *   • owner   — /vet/register   (the wizard)
 *   • staff   — /vet/invite, /vet (onboarding checklist)
 */

import * as React from "react";
import type {
  ClinicDocumentKind,
  ClinicOrgStatus,
  RegistrationGap,
  RegistrationStep,
  VetRole,
} from "@moraqat/core";
import { useAuth, type AuthUser } from "@/lib/auth";
import { fetchWithTimeout, httpError, ApiError } from "@/lib/http";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type Bilingual = { ar: string; en: string };
/** Dates arrive as ISO strings over JSON. */
type ISO = string;

/* ────────────────────────────────────────────────────────────────────────── */
/* Wire types                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RegOrg {
  id: string;
  slug: string;
  status: ClinicOrgStatus;
  statusLabel: Bilingual;
  tier: string | null;
  nameAr: string;
  nameEn: string;
  legalNameAr: string | null;
  legalNameEn: string | null;
  crNumber: string | null;
  unifiedNumber: string | null;
  crExpiresAt: ISO | null;
  vatNumber: string | null;
  logoUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  submittedAt: ISO | null;
  reviewedAt: ISO | null;
  verified: boolean;
  changesRequestedNote: string | null;
  changesRequestedSteps: RegistrationStep[];
  rejectedReason: string | null;
  createdAt: ISO;
}

export interface RegBranchHour {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface RegBranch {
  id: string;
  nameAr: string;
  nameEn: string;
  cityCode: string | null;
  city: { code: string; ar: string; en: string } | null;
  district: string | null;
  addressLine: string | null;
  nationalAddressCode: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  phone: string | null;
  email: string | null;
  hours: RegBranchHour[];
  emergency24h: boolean;
  services: string[];
  licenceNo: string | null;
  licenceExpiresAt: ISO | null;
  directoryVisible: boolean;
  isActive: boolean;
}

export interface RegDocument {
  id: string;
  scope: "org" | "branch";
  kind: ClinicDocumentKind;
  label: Bilingual;
  branchId: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  number: string | null;
  expiresAt: ISO | null;
  verified: boolean;
  verifiedAt: ISO | null;
  /** CR (org) and MEWA licence (each branch) must be verified before approval. */
  required: boolean;
  createdAt: ISO;
}

export interface RegTeamMember {
  fullName: string;
  email: string;
  /** E.164, normalised by the API. */
  phone: string;
  role: VetRole;
  title?: string | null;
  licenceNo?: string | null;
  licenceExpiresAt?: string | null;
  /** Empty = every branch. */
  branchIds: string[];
}

export interface RegInvite {
  id: string;
  email: string;
  fullName: string | null;
  role: VetRole;
  roleLabel: Bilingual;
  state: "pending" | "accepted" | "expired";
  expiresAt: ISO;
  createdAt: ISO;
}

export interface RegistrationState {
  org: RegOrg;
  /** Steps the owner may change right now (empty while under review). */
  editableSteps: RegistrationStep[];
  branches: RegBranch[];
  documents: RegDocument[];
  team: RegTeamMember[];
  invites: RegInvite[];
  terms: {
    currentVersion: string;
    accepted: {
      version: number;
      termsVersion: string | null;
      signedAt: ISO | null;
      signedByName: string | null;
      signedByTitle: string | null;
    } | null;
  };
  /** Everything blocking submission, bilingual and linked to a step. Empty = ready. */
  gaps: RegistrationGap[];
  owner: {
    name: string | null;
    email: string;
    /** The owner is a practising vet (solo practice) — their seat carries the licence. */
    practisesAsVet: boolean;
    licenceNo: string | null;
    licenceExpiresAt: ISO | null;
    title: string | null;
  } | null;
  /** Only present on the admin endpoint; null for the owner. */
  admin: RegAdminExtras | null;
}

export interface RegAdminExtras {
  isDemo: boolean;
  inviteNote: string | null;
  suspendedAt: ISO | null;
  suspendReason: string | null;
  agreement: {
    version: number;
    termsVersion: string | null;
    contentHash: string | null;
    signedAt: ISO | null;
    signedByName: string | null;
    signedByTitle: string | null;
    ipAddress: string | null;
  } | null;
  registrationInvite: {
    email: string;
    createdAt: ISO;
    expiresAt: ISO;
    claimedAt: ISO | null;
    revokedAt: ISO | null;
    expired: boolean;
  } | null;
  staff: {
    id: string;
    role: VetRole;
    roleLabel: Bilingual;
    status: "INVITED" | "ACTIVE" | "SUSPENDED" | "OFFBOARDED";
    name: string | null;
    email: string;
    phone: string | null;
    title: string | null;
    licenceNo: string | null;
    licenceExpiresAt: ISO | null;
    confidentialityAccepted: boolean;
    hasCounterPin: boolean;
    joinedAt: ISO | null;
  }[];
  checklist: { branchesConfirmedAt: ISO | null; testScanAt: ISO | null; goLiveRequestedAt: ISO | null };
}

export interface AdminClinicRow {
  id: string;
  nameAr: string;
  nameEn: string;
  status: ClinicOrgStatus;
  statusLabel: Bilingual;
  tier: string | null;
  isDemo: boolean;
  verified: boolean;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  city: { nameAr: string; nameEn: string } | null;
  branchCount: number;
  staffCount: number;
  submittedAt: ISO | null;
  createdAt: ISO;
  updatedAt: ISO;
  testScanAt: ISO | null;
  goLiveRequestedAt: ISO | null;
  invite: { expiresAt: ISO; claimed: boolean; revoked: boolean; expired: boolean } | null;
}

export interface AdminClinicList {
  items: AdminClinicRow[];
  statusCounts: Partial<Record<ClinicOrgStatus, number>>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface InviteClinicInput {
  nameAr: string;
  nameEn?: string;
  contactName: string;
  email: string;
  phone: string;
  tier?: "founding" | "standard";
  note?: string;
}

export interface InviteClinicResult {
  org: { id: string; slug: string; nameAr: string; nameEn: string; status: ClinicOrgStatus };
  invite: { id: string; email: string; expiresAt: ISO };
}

export interface RegistrationPreview {
  orgId: string;
  orgName: Bilingual;
  status: ClinicOrgStatus;
  email: string;
  contactName: string | null;
  contactPhone: string | null;
  expiresAt: ISO;
  claimed: boolean;
  accountExists: boolean;
}

export interface MyRegistration {
  id: string;
  nameAr: string;
  nameEn: string;
  status: ClinicOrgStatus;
  updatedAt: ISO;
  statusLabel: Bilingual;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface ClinicInput {
  nameAr: string;
  nameEn: string;
  legalNameAr: string;
  legalNameEn?: string;
  crNumber: string;
  unifiedNumber: string;
  /** YYYY-MM-DD */
  crExpiresAt: string;
  vatNumber?: string;
  logoUrl?: string;
}

export interface BranchInput {
  id?: string;
  nameAr: string;
  nameEn?: string;
  cityCode: string;
  district: string;
  addressLine: string;
  nationalAddressCode?: string;
  lat: number;
  lng: number;
  mapsUrl?: string;
  phone: string;
  email?: string;
  hours?: RegBranchHour[];
  emergency24h?: boolean;
  services?: string[];
  licenceNo: string;
  /** YYYY-MM-DD */
  licenceExpiresAt: string;
}

export interface TeamMemberInput {
  fullName: string;
  email: string;
  phone: string;
  role: VetRole;
  title?: string;
  licenceNo?: string;
  licenceExpiresAt?: string;
  branchIds?: string[];
}

/** Solo practice: the owner is also the (or a) veterinarian. */
export interface OwnerPractiseInput {
  ownerPractisesAsVet: boolean;
  ownerLicenceNo?: string;
  /** YYYY-MM-DD */
  ownerLicenceExpiresAt?: string;
  ownerTitle?: string;
}

export interface SubmitInput {
  acceptTerms: true;
  termsVersion: string;
  signedByName: string;
  signedByTitle: string;
}

/** Go-live checklist — GET /vet/org/onboarding. */
export interface OnboardingState {
  status: ClinicOrgStatus;
  verified: boolean;
  items: {
    branches: { done: boolean; at: ISO | null };
    device: { done: boolean; count: number };
    pins: { done: boolean; count: number; of: number };
    testScan: { done: boolean; at: ISO | null };
  };
  /** Required items done (branches + device + test scan). */
  ready: boolean;
  goLiveRequestedAt: ISO | null;
  /** The demo cat to scan. Null when the demo seed hasn't been run. */
  testCat: { name: string; microchipNo: string | null; catIdNumber: string | null } | null;
}

/** Staff invitation preview — POST /vet/auth/invite/preview. */
export interface StaffInvitePreview {
  orgName: Bilingual;
  orgLogoUrl: string | null;
  orgStatus: ClinicOrgStatus;
  email: string;
  fullName: string | null;
  role: VetRole;
  roleLabel: Bilingual;
  expiresAt: ISO;
  accountExists: boolean;
  confidentialityVersion: string;
}

export interface StaffInviteAccepted {
  staffId: string;
  orgId: string;
  role: VetRole;
  roleLabel: Bilingual;
  capabilities: string[];
  org: { nameEn: string; nameAr: string; status: ClinicOrgStatus };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Public calls (no session)                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

async function publicPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw httpError(res.status, json);
  return json as T;
}

export function previewRegistrationInvite(token: string) {
  return publicPost<RegistrationPreview>("/vet/registration/invite/preview", { token });
}

export function createOwnerAccount(input: {
  token: string;
  firstName: string;
  lastName?: string;
  phone: string;
  password: string;
}) {
  return publicPost<AuthSession & { registration: { orgId: string; status: ClinicOrgStatus } }>(
    "/vet/registration/invite/account",
    input
  );
}

export function previewStaffInvite(token: string) {
  return publicPost<StaffInvitePreview>("/vet/auth/invite/preview", { token });
}

export function claimStaffInvite(input: {
  token: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  password: string;
  acceptConfidentiality: true;
  confidentialityVersion: string;
}) {
  return publicPost<AuthSession & { accepted: StaffInviteAccepted }>("/vet/auth/invite/claim", input);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Authenticated calls                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RegistrationApi {
  // owner
  mine(): Promise<{ items: MyRegistration[] }>;
  claim(token: string): Promise<{ orgId: string; status: ClinicOrgStatus }>;
  state(orgId: string): Promise<RegistrationState>;
  saveClinic(orgId: string, input: ClinicInput): Promise<RegistrationState>;
  saveBranches(orgId: string, branches: BranchInput[]): Promise<RegistrationState>;
  uploadDocument(
    orgId: string,
    input: { file: File; kind: ClinicDocumentKind; branchId?: string; number?: string; expiresAt?: string }
  ): Promise<RegistrationState>;
  deleteDocument(orgId: string, documentId: string): Promise<RegistrationState>;
  /** Blob of a private document — render via URL.createObjectURL and revoke after. */
  ownerDocumentBlob(orgId: string, documentId: string): Promise<Blob>;
  saveTeam(orgId: string, members: TeamMemberInput[], owner?: OwnerPractiseInput): Promise<RegistrationState>;
  submit(orgId: string, input: SubmitInput): Promise<RegistrationState>;
  // staff
  acceptStaffInvite(token: string, confidentialityVersion: string): Promise<StaffInviteAccepted>;
  // admin
  adminList(params: { status?: string; q?: string; page?: number }): Promise<AdminClinicList>;
  adminInvite(input: InviteClinicInput): Promise<InviteClinicResult>;
  adminDetail(orgId: string): Promise<RegistrationState>;
  adminResendInvite(orgId: string): Promise<unknown>;
  adminRevokeInvite(orgId: string): Promise<unknown>;
  adminDocumentBlob(orgId: string, documentId: string): Promise<Blob>;
  adminVerifyDocument(orgId: string, documentId: string, verified: boolean): Promise<RegistrationState>;
  adminRequestChanges(orgId: string, input: { note: string; steps: RegistrationStep[] }): Promise<RegistrationState>;
  adminApprove(orgId: string, note?: string): Promise<RegistrationState>;
  adminReject(orgId: string, reason: string): Promise<RegistrationState>;
  /** Existing /vet/admin/orgs lifecycle actions. */
  adminOrgAction(orgId: string, action: "go-live" | "verify" | "unverify" | "unsuspend"): Promise<unknown>;
  adminSuspend(orgId: string, reason: string): Promise<unknown>;
}

export function useRegistrationApi(): RegistrationApi {
  const { authedFetch, authedBlob, authedUpload } = useAuth();
  return React.useMemo<RegistrationApi>(() => {
    const post = <T,>(path: string, body: unknown = {}) =>
      authedFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
    const put = <T,>(path: string, body: unknown) =>
      authedFetch<T>(path, { method: "PUT", body: JSON.stringify(body) });
    const enc = encodeURIComponent;
    return {
      mine: () => authedFetch("/vet/registration"),
      claim: (token) => post("/vet/registration/invite/claim", { token }),
      state: (orgId) => authedFetch(`/vet/registration/${enc(orgId)}`),
      saveClinic: (orgId, input) => put(`/vet/registration/${enc(orgId)}/clinic`, input),
      saveBranches: (orgId, branches) => put(`/vet/registration/${enc(orgId)}/branches`, { branches }),
      uploadDocument: (orgId, input) => {
        const form = new FormData();
        form.append("file", input.file);
        form.append("kind", input.kind);
        if (input.branchId) form.append("branchId", input.branchId);
        if (input.number) form.append("number", input.number);
        if (input.expiresAt) form.append("expiresAt", input.expiresAt);
        return authedUpload<RegistrationState>(`/vet/registration/${enc(orgId)}/documents`, form);
      },
      deleteDocument: (orgId, documentId) =>
        authedFetch(`/vet/registration/${enc(orgId)}/documents/${enc(documentId)}`, { method: "DELETE" }),
      ownerDocumentBlob: (orgId, documentId) =>
        authedBlob(`/vet/registration/${enc(orgId)}/documents/${enc(documentId)}/file`),
      saveTeam: (orgId, members, owner) =>
        put(`/vet/registration/${enc(orgId)}/team`, { members, ...(owner ?? {}) }),
      submit: (orgId, input) => post(`/vet/registration/${enc(orgId)}/submit`, input),

      acceptStaffInvite: (token, confidentialityVersion) =>
        post("/vet/auth/accept-invite", { token, acceptConfidentiality: true, confidentialityVersion }),

      adminList: ({ status, q, page }) => {
        const qs = new URLSearchParams();
        if (status) qs.set("status", status);
        if (q) qs.set("q", q);
        if (page) qs.set("page", String(page));
        return authedFetch(`/vet/admin/clinics${qs.size ? `?${qs.toString()}` : ""}`);
      },
      adminInvite: (input) => post("/vet/admin/clinics/invite", input),
      adminDetail: (orgId) => authedFetch(`/vet/admin/clinics/${enc(orgId)}`),
      adminResendInvite: (orgId) => post(`/vet/admin/clinics/${enc(orgId)}/invite/resend`),
      adminRevokeInvite: (orgId) => post(`/vet/admin/clinics/${enc(orgId)}/invite/revoke`),
      adminDocumentBlob: (orgId, documentId) =>
        authedBlob(`/vet/admin/clinics/${enc(orgId)}/documents/${enc(documentId)}/file`),
      adminVerifyDocument: (orgId, documentId, verified) =>
        post(`/vet/admin/clinics/${enc(orgId)}/documents/${enc(documentId)}/${verified ? "verify" : "unverify"}`),
      adminRequestChanges: (orgId, input) => post(`/vet/admin/clinics/${enc(orgId)}/request-changes`, input),
      adminApprove: (orgId, note) => post(`/vet/admin/clinics/${enc(orgId)}/approve`, note ? { note } : {}),
      adminReject: (orgId, reason) => post(`/vet/admin/clinics/${enc(orgId)}/reject`, { reason }),
      adminOrgAction: (orgId, action) => post(`/vet/admin/orgs/${enc(orgId)}/${action}`),
      adminSuspend: (orgId, reason) => post(`/vet/admin/orgs/${enc(orgId)}/suspend`, { reason }),
    };
  }, [authedFetch, authedBlob, authedUpload]);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Errors — bilingual copy for every registration code                        */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RegFriendlyError {
  title: string;
  message: string;
  code?: string;
  /** Present on VET_REG_INCOMPLETE — render the list, don't just say "no". */
  gaps?: RegistrationGap[];
}

const COPY: Record<string, { ar: [string, string]; en: [string, string] }> = {
  VET_INVITE_INVALID: {
    ar: ["الرابط لم يعد صالحاً", "ربما أُرسل رابط أحدث أو أُلغيت الدعوة. افتح آخر رسالة وصلتك، أو تواصل مع مرقط."],
    en: ["This link is no longer valid", "A newer link may have been sent, or the invitation was withdrawn. Open the latest email, or contact Moracat."],
  },
  VET_INVITE_EXPIRED: {
    ar: ["انتهت صلاحية الدعوة", "اطلب رابطاً جديداً — يصلك خلال دقائق."],
    en: ["This invitation has expired", "Ask for a new link — it arrives within minutes."],
  },
  VET_INVITE_USED: {
    ar: ["استُخدمت هذه الدعوة", "سجّل دخولك بالبريد نفسه للمتابعة."],
    en: ["This invitation was already used", "Sign in with the same email to continue."],
  },
  VET_INVITE_EMAIL_MISMATCH: {
    ar: ["البريد مختلف", "الدعوة أُرسلت إلى بريد آخر. سجّل الخروج ثم ادخل بالبريد الذي وصلته الدعوة."],
    en: ["Different email", "This invitation went to another address. Sign out, then sign in with the invited email."],
  },
  VET_CONFIDENTIALITY_REQUIRED: {
    ar: ["وافق على تعهّد السرية", "لا يمكن الانضمام للعيادة قبل الموافقة على النسخة الحالية من تعهّد السرية."],
    en: ["Accept the confidentiality undertaking", "You can't join the clinic before accepting the current confidentiality undertaking."],
  },
  VET_REG_PHONE_INVALID: {
    ar: ["رقم الجوال غير صحيح", "اكتب رقم جوال سعودي مثل 05XXXXXXXX."],
    en: ["Check the mobile number", "Enter a Saudi mobile number like 05XXXXXXXX."],
  },
  VET_REG_ALREADY_INVITED: {
    ar: ["توجد دعوة سابقة", "هذا البريد لديه تسجيل عيادة قيد الإجراء. افتحه من القائمة وأعد إرسال الدعوة."],
    en: ["Already invited", "This email already has a clinic registration in progress. Open it from the list and resend the invite."],
  },
  VET_REG_WRONG_STATUS: {
    ar: ["لا يمكن تنفيذ ذلك الآن", "حالة الطلب تغيّرت. حدّث الصفحة لترى آخر وضع."],
    en: ["That can't be done right now", "The registration's status has changed. Refresh to see where it stands."],
  },
  VET_REG_LOCKED: {
    ar: ["القسم مقفل", "الطلب لدى مرقط للمراجعة، أو أن هذا القسم لم يُفتح للتعديل."],
    en: ["This section is locked", "The registration is with Moracat for review, or this section wasn't reopened for changes."],
  },
  VET_REG_INCOMPLETE: {
    ar: ["بقيت بعض البيانات", "أكمل البنود التالية ثم أرسل."],
    en: ["A few details are missing", "Complete the items below, then submit."],
  },
  VET_REG_TERMS_OUTDATED: {
    ar: ["تحدّثت الشروط", "حدّث الصفحة واقرأ النسخة الحالية قبل الموافقة."],
    en: ["The terms were updated", "Refresh and read the current version before accepting."],
  },
  VET_REG_DOCS_UNVERIFIED: {
    ar: ["مستندات لم تُراجع", "تحقّق من كل مستند مطلوب قبل الموافقة على العيادة."],
    en: ["Documents not checked", "Verify every required document before approving the clinic."],
  },
  VET_REG_TEAM_DUPLICATE: {
    ar: ["بريد مكرر", "كل عضو في الفريق يحتاج بريداً مختلفاً."],
    en: ["Duplicate email", "Each team member needs a different email address."],
  },
  VET_REG_TEAM_OWNER: {
    ar: ["أنت مضاف مسبقاً", "أنت ضمن الفريق بصفتك المالك — لا حاجة لإضافة بريدك."],
    en: ["You're already on the team", "You're on the team as the owner — no need to add your own email."],
  },
  VET_REG_OWNER_LICENCE: {
    ar: ["رقم ترخيصك مطلوب", "بما أنك تمارس المهنة في العيادة، أدخل رقم ترخيص مزاولة المهنة الخاص بك."],
    en: ["Your licence number is needed", "Since you practise at the clinic, enter your practitioner licence number."],
  },
  VET_DOC_MISSING: {
    ar: ["اختر ملفاً", "لم يصلنا أي ملف."],
    en: ["Choose a file", "No file was received."],
  },
  VET_DOC_TOO_LARGE: {
    ar: ["الملف كبير", "الحد الأقصى ١٠ ميجابايت. صوّره بجودة أقل أو احفظه PDF."],
    en: ["File too large", "The limit is 10 MB. Photograph it at lower quality or save it as a PDF."],
  },
  VET_DOC_TYPE: {
    ar: ["نوع الملف غير مدعوم", "ارفع PDF أو JPG أو PNG."],
    en: ["File type not supported", "Upload a PDF, JPG or PNG."],
  },
  VET_DOC_NOT_FOUND: {
    ar: ["المستند غير موجود", "ربما استُبدل بنسخة أحدث. حدّث الصفحة."],
    en: ["Document not found", "It may have been replaced by a newer copy. Refresh the page."],
  },
  VET_ORG_CR_TAKEN: {
    ar: ["السجل التجاري مسجّل", "عيادة بهذا السجل موجودة في مرقط. اطلب من مالكها دعوتك."],
    en: ["CR already registered", "A clinic with this CR is already on Moracat. Ask its owner to invite you."],
  },
  VET_BRANCH_NOT_FOUND: {
    ar: ["الفرع غير موجود", "حدّث الصفحة وحاول مجدداً."],
    en: ["Branch not found", "Refresh the page and try again."],
  },
  VET_GO_LIVE_NOT_READY: {
    ar: ["لم تكتمل قائمة التجهيز", "بقي مسح تجريبي ناجح أو تسجيل جهاز الاستقبال قبل التفعيل."],
    en: ["Checklist not finished", "A successful test scan or counter device registration is still needed before going live."],
  },
  VET_ORG_NOT_LIVE: {
    ar: ["العيادة لم تُفعَّل بعد", "سجلات الأعضاء تُفتح بعد أن تفعّل مرقط العيادة."],
    en: ["The clinic isn't live yet", "Member records open once Moracat switches the clinic live."],
  },
  VET_NOT_STAFF: {
    ar: ["ليست لديك صلاحية", "هذا الإجراء لمالك العيادة فقط."],
    en: ["Not allowed", "Only the clinic owner can do this."],
  },
  EMAIL_TAKEN: {
    ar: ["لديك حساب مسبقاً", "هذا البريد مسجّل في مرقط — سجّل دخولك للمتابعة."],
    en: ["You already have an account", "This email is already on Moracat — sign in to continue."],
  },
  WEAK_PASSWORD: {
    ar: ["كلمة المرور ضعيفة", "استخدم ٨ أحرف على الأقل تجمع حروفاً وأرقاماً."],
    en: ["Password too weak", "Use at least 8 characters mixing letters and numbers."],
  },
};

export function registrationError(err: unknown, isAr: boolean): RegFriendlyError {
  const e = err as ApiError & { code?: string; extras?: Record<string, unknown> };
  const code = e?.code;
  const copy = code ? COPY[code] : undefined;
  const gaps = Array.isArray(e?.extras?.gaps) ? (e.extras!.gaps as RegistrationGap[]) : undefined;
  if (copy) {
    const [title, message] = isAr ? copy.ar : copy.en;
    return { title, message, code, gaps };
  }
  if (e instanceof ApiError && (e.kind === "timeout" || e.kind === "network")) {
    return isAr
      ? { title: "تعذّر الاتصال", message: "تحقّق من الإنترنت وحاول مرة أخرى — لم يُفقد شيء مما كتبته." }
      : { title: "Couldn't connect", message: "Check your connection and try again — nothing you typed was lost." };
  }
  // Validation messages from class-validator are English-only; say so kindly in
  // Arabic rather than showing English to an Arabic user.
  if (e instanceof ApiError && e.status === 400) {
    return isAr
      ? { title: "راجع البيانات", message: "بعض الحقول بصيغة غير صحيحة. تأكد من الأرقام والتواريخ ثم حاول مجدداً.", code }
      : { title: "Check the details", message: e.message || "Some fields aren't in the right format.", code };
  }
  return isAr
    ? { title: "حدث خطأ", message: "لم يكتمل الطلب. حاول مرة أخرى بعد قليل.", code }
    : { title: "Something went wrong", message: "That didn't go through. Please try again shortly.", code };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Small helpers                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/** ISO date → "YYYY-MM-DD" for <input type="date">. */
export function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

export function formatBytes(n: number | null | undefined, isAr: boolean): string {
  if (!n) return "—";
  const mb = n / (1024 * 1024);
  const value = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
  return isAr ? value.replace("MB", "م.ب").replace("KB", "ك.ب") : value;
}

/** Open a private document blob in a new tab and release it after. */
export async function openPrivateDocument(load: () => Promise<Blob>): Promise<void> {
  // Open the tab synchronously inside the click, THEN load: a window.open after
  // an await is treated as a popup and blocked by Safari and others.
  const tab = typeof window !== "undefined" ? window.open("", "_blank") : null;
  try {
    const blob = await load();
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
