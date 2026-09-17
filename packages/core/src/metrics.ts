/**
 * The operating metrics (MRC-STRAT-001 §F) — definitions shared by the nightly
 * roll-up, the admin dashboard and the tests, so "clinic-verified active cat"
 * means exactly one thing everywhere.
 */

/**
 * CVAC — Clinic-Verified Active Cat, the north-star metric. A registered cat
 * counts when a clinic has written a final clinical entry about it inside the
 * record window AND the owner is still around (signed in within the activity
 * window). A registration is not an asset; a record that keeps being written
 * and read is.
 */
export const CVAC_RECORD_WINDOW_DAYS = 395; // 13 months — one annual booster cycle plus slack
export const CVAC_OWNER_ACTIVE_DAYS = 90;

/** Shape of one day's `MetricSnapshot.data`. Every number is a plain count. */
export interface MetricSnapshotData {
  /** Accounts created that day. */
  registrations: number;
  /** Cat IDs issued that day (owner-registered + claimed clinic patients). */
  catIdsIssued: number;
  /** Cumulative registered cats (live, claimed) at the end of the day. */
  catsRegisteredTotal: number;
  /** Registered cats by how they entered the record. */
  catsByOrigin: { OWNER: number; CLINIC: number; ADMIN_IMPORT: number };
  /** Cumulative CVAC at the end of the day. */
  cvac: number;
  /** Clinic-created patients that day / claims accepted that day. */
  clinicPatientsCreated: number;
  claimsAccepted: number;
  /** Clinics able to work (LIVE) at the end of the day. */
  clinicsLive: number;
  /** Final clinical entries written that day. */
  clinicalEntries: number;
  /** Reminders sent / reminder links tapped that day. */
  remindersSent: number;
  reminderClicks: number;
  /** Memberships active at the end of the day. */
  activeMemberships: number;
}

export const EMPTY_METRICS: MetricSnapshotData = {
  registrations: 0,
  catIdsIssued: 0,
  catsRegisteredTotal: 0,
  catsByOrigin: { OWNER: 0, CLINIC: 0, ADMIN_IMPORT: 0 },
  cvac: 0,
  clinicPatientsCreated: 0,
  claimsAccepted: 0,
  clinicsLive: 0,
  clinicalEntries: 0,
  remindersSent: 0,
  reminderClicks: 0,
  activeMemberships: 0,
};

/** Start/end of a calendar day in a fixed zone offset (Riyadh is UTC+3, no DST). */
export const RIYADH_OFFSET_MS = 3 * 3_600_000;

export function riyadhDayBounds(at: Date): { start: Date; end: Date; day: string } {
  const local = new Date(at.getTime() + RIYADH_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const start = new Date(Date.UTC(y, m, d) - RIYADH_OFFSET_MS);
  const end = new Date(start.getTime() + 86_400_000);
  const day = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { start, end, day };
}
