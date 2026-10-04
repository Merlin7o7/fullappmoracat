/**
 * Sign-up state that must survive a refresh, the phone's Back button and the
 * hop from /register to the issue step (R117 — never lose entered data).
 *
 * Three sessionStorage keys, each with one job:
 *  - SIGNUP_DRAFT_KEY  the form as typed (restored on mount, cleared only once
 *                      the Cat ID is actually issued). Never the OTP code.
 *  - HANDOFF_KEY       what /register hands the issue step (consumed on read).
 *  - PHOTO_RETRY_KEY   a sign-up photo whose upload failed at issue time, kept
 *                      so the welcome screen can retry it instead of losing it.
 */

export const SIGNUP_DRAFT_KEY = "moraqat.signupDraft";
export const HANDOFF_KEY = "moraqat.draftCat";
export const PHOTO_RETRY_KEY = "moraqat.photoRetry";
export const PENDING_NAME_KEY = "moraqat.pendingCatName";
export const REGISTER_STARTED_KEY = "moraqat.registerStarted";

/** A compressed photo above this many characters isn't kept in the draft. */
export const PHOTO_PERSIST_MAX = 900_000;

export interface SignupDraft {
  name?: string;
  ownerName?: string;
  dialCode?: string;
  phone?: string;
  email?: string;
  waitlistConsent?: boolean;
  sharePublicly?: boolean;
  photo?: string | null;
  /** The upload happened with the people-in-photo line visible (R106). */
  photoAttested?: boolean;
  /** A photo was chosen but was too large to keep across a refresh. */
  photoDropped?: boolean;
}

/** What the issue step receives from /register. */
export interface SignupHandoff {
  name: string;
  photo?: string | null;
  photoAttested?: boolean;
  ownerName?: string;
  dialCode?: string;
  phone?: string;
  waitlistConsent?: boolean;
  sharePublicly?: boolean;
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Merge a field into the draft (e.g. /login carrying an unregistered email over). */
export function patchSignupDraft(patch: Partial<SignupDraft>) {
  writeJson(SIGNUP_DRAFT_KEY, { ...(readJson<SignupDraft>(SIGNUP_DRAFT_KEY) ?? {}), ...patch });
}

/** After a successful issue: nothing of the sign-up lingers. */
export function clearSignupDraft() {
  removeKey(SIGNUP_DRAFT_KEY);
  removeKey(HANDOFF_KEY);
  removeKey(PENDING_NAME_KEY);
}

/** A data: URL → File, decoded in memory (the CSP forbids fetch(data:)). */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, b64 = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head ?? "")?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

/** Same-name check, forgiving case and stray spaces. */
export function sameCatName(a: string, b: string): boolean {
  const n = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return n(a) === n(b);
}
