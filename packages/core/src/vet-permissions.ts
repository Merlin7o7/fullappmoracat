/**
 * Clinic-side capability model — MRC-VET-001 §14.
 *
 * Deliberately SEPARATE from the Moracat admin RBAC (Role/Permission rows).
 * Clinic capability is a property of a person's membership *in one org*, not a
 * global grant: the same vet may be a VET at one clinic and an OWNER at their
 * own. Keeping it a pure function of (role, context) means it is identical on
 * the server (authorisation) and in the browser (what to even render), with no
 * second source of truth to drift.
 *
 * Two rules this file exists to make structurally true:
 *   • A receptionist can never author or read clinical records.
 *   • A veterinarian can never touch billing or clinic settings.
 *
 * Counter Mode (a shared front-desk terminal unlocked by PIN) additionally
 * REMOVES capabilities — a kiosk identity can never export data, manage staff,
 * or change settings, whatever the person's role.
 */

export type VetRole =
  | "OWNER"
  | "MANAGER"
  | "VET_SENIOR"
  | "VET"
  | "VET_TECH"
  | "RECEPTION"
  | "FINANCE"
  | "INTERN";

export type VetCapability =
  // patients & records
  | "patient.search" // find a cat by identifier
  | "patient.view" // open the clinical profile (subject to consent tier)
  | "record.read" // read clinical entries
  | "record.write" // author clinical entries
  | "record.cosign" // countersign a trainee's draft
  | "record.retract" // withdraw an entry (append-only correction)
  | "prescription.write"
  | "prescription.dispense"
  | "lab.upload"
  | "attachment.upload"
  // visits
  | "visit.open"
  | "visit.close"
  // emergency
  | "emergency.access" // break-glass tier-0 view
  // clinic operations
  | "billing.view"
  | "billing.write"
  | "staff.manage"
  | "branch.manage"
  | "settings.manage"
  | "device.manage"
  | "export.data"
  | "reports.view";

const ALL_CLINICAL: VetCapability[] = [
  "patient.search",
  "patient.view",
  "record.read",
  "record.write",
  "record.retract",
  "prescription.write",
  "lab.upload",
  "attachment.upload",
  "visit.open",
  "visit.close",
  "emergency.access",
];

/**
 * The matrix. Least privilege per function — a role gets exactly what its job
 * needs at a real counter, and nothing that would make it a liability.
 */
const MATRIX: Record<VetRole, VetCapability[]> = {
  // Runs the business: everything.
  OWNER: [
    ...ALL_CLINICAL,
    "record.cosign",
    "prescription.dispense",
    "billing.view",
    "billing.write",
    "staff.manage",
    "branch.manage",
    "settings.manage",
    "device.manage",
    "export.data",
    "reports.view",
  ],
  // Runs the clinic day-to-day, but is not assumed to be a clinician: no
  // authoring of medical records unless they also hold a vet role.
  MANAGER: [
    "patient.search",
    "patient.view",
    "record.read",
    "visit.open",
    "visit.close",
    "emergency.access",
    "billing.view",
    "billing.write",
    "staff.manage",
    "branch.manage",
    "settings.manage",
    "device.manage",
    "export.data",
    "reports.view",
  ],
  // The senior clinician: full clinical authority + the power to co-sign
  // trainees. Explicitly NO billing (a clinical decision must never be
  // shaped by what it bills).
  VET_SENIOR: [...ALL_CLINICAL, "record.cosign", "prescription.dispense", "reports.view"],
  VET: [...ALL_CLINICAL, "prescription.dispense"],
  // Technicians take vitals and assist; they may record observations and
  // upload results, but never prescribe.
  VET_TECH: [
    "patient.search",
    "patient.view",
    "record.read",
    "record.write",
    "lab.upload",
    "attachment.upload",
    "visit.open",
    "emergency.access",
  ],
  // The front desk. Can find a patient, open a visit and see safety alerts —
  // and CANNOT read or write the clinical record. This is the rule the whole
  // matrix exists to guarantee.
  RECEPTION: ["patient.search", "visit.open", "emergency.access", "billing.view"],
  FINANCE: ["billing.view", "billing.write", "reports.view", "export.data"],
  // Trainees author real records, but everything they write stays DRAFT until
  // a senior co-signs — teaching and legal attribution in one workflow.
  INTERN: [
    "patient.search",
    "patient.view",
    "record.read",
    "record.write",
    "attachment.upload",
    "emergency.access",
  ],
};

/** Capabilities a shared-terminal (PIN) session can never hold, whatever the role. */
const COUNTER_MODE_DENIED: ReadonlySet<VetCapability> = new Set<VetCapability>([
  "export.data",
  "settings.manage",
  "staff.manage",
  "branch.manage",
  "device.manage",
  "billing.write",
]);

export interface VetActorContext {
  role: VetRole;
  /** True when the session was unlocked by PIN on a registered counter device. */
  counterMode?: boolean;
}

/** Every capability this actor holds, in this context. */
export function capabilitiesFor(ctx: VetActorContext): VetCapability[] {
  const base = MATRIX[ctx.role] ?? [];
  if (!ctx.counterMode) return [...base];
  return base.filter((c) => !COUNTER_MODE_DENIED.has(c));
}

/** Authorisation check. The single predicate the API guard and the UI both use. */
export function can(ctx: VetActorContext, capability: VetCapability): boolean {
  if (ctx.counterMode && COUNTER_MODE_DENIED.has(capability)) return false;
  return (MATRIX[ctx.role] ?? []).includes(capability);
}

/** Roles a given role is allowed to invite/assign — nobody escalates past themselves. */
export function assignableRoles(role: VetRole): VetRole[] {
  switch (role) {
    case "OWNER":
      return ["MANAGER", "VET_SENIOR", "VET", "VET_TECH", "RECEPTION", "FINANCE", "INTERN"];
    case "MANAGER":
      return ["VET_SENIOR", "VET", "VET_TECH", "RECEPTION", "INTERN"];
    default:
      return [];
  }
}

/** Does this role's clinical authorship need a co-signature to become final? */
export function requiresCoSign(role: VetRole): boolean {
  return role === "INTERN";
}

/** Bilingual role labels — one source, used by the portal and by admin. */
export const VET_ROLE_LABELS: Record<VetRole, { en: string; ar: string }> = {
  OWNER: { en: "Clinic owner", ar: "مالك العيادة" },
  MANAGER: { en: "Clinic manager", ar: "مدير العيادة" },
  VET_SENIOR: { en: "Senior veterinarian", ar: "طبيب بيطري أول" },
  VET: { en: "Veterinarian", ar: "طبيب بيطري" },
  VET_TECH: { en: "Veterinary technician", ar: "فني بيطري" },
  RECEPTION: { en: "Receptionist", ar: "موظف استقبال" },
  FINANCE: { en: "Finance", ar: "الحسابات" },
  INTERN: { en: "Intern", ar: "متدرب" },
};
