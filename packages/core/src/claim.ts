/**
 * Clinic-created patients and the claim link (MRC-PROD-001 T4).
 *
 * A walk-in cat is created at the counter and owned, until claimed, by one
 * system placeholder account. The owner follows a claim link (SMS or a QR on
 * the counter screen); accepting moves the cat to them and issues the Cat ID.
 * The rules here are shared by the API and the portal so the two never drift.
 */

/** The one system account that holds every not-yet-claimed cat. */
export const PLACEHOLDER_OWNER_EMAIL = "pending-claims@system.moracat.co";

export const CLAIM_TTL_DAYS = 30;
export const MAX_CLAIM_SENDS = 3;
export const CLAIM_RESEND_COOLDOWN_MS = 24 * 3_600_000;

/** Saudi-aware E.164 normalisation: 05…, 5…, 9665…, 009665…, +9665… → +9665…. */
export function normalizeSaudiPhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  if (!/^\+?\d{7,15}$/.test(digits)) return null;
  let d = digits.replace(/^\+/, "").replace(/^00/, "");
  if (d.startsWith("966")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  if (/^5\d{8}$/.test(d)) return `+966${d}`;
  // A non-Saudi number — keep it in E.164 as typed.
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function phoneLast4(phone: string): string {
  return phone.replace(/\D/g, "").slice(-4);
}

export function claimPath(token: string): string {
  return `/claim/${token}`;
}

/** The SMS the owner receives. Short: a name, a clinic, a link. Both languages. */
export function claimSmsText(input: { catName: string; clinicNameAr: string; clinicNameEn: string; url: string }): string {
  return (
    `${input.clinicNameAr} سجّلت ${input.catName} في مُراقط. افتح الرابط لاستلام هوية قطك: ${input.url}\n` +
    `${input.clinicNameEn} registered ${input.catName} on Moracat. Open the link to claim your cat's ID.`
  );
}

export type ClaimState = "valid" | "expired" | "claimed" | "revoked";

export function claimState(invite: { expiresAt: Date | string; claimedAt: Date | string | null; revokedAt: Date | string | null }, now = new Date()): ClaimState {
  if (invite.claimedAt) return "claimed";
  if (invite.revokedAt) return "revoked";
  return new Date(invite.expiresAt).getTime() <= now.getTime() ? "expired" : "valid";
}
