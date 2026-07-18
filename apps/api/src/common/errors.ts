/**
 * Structured auth/account error bodies.
 *
 * Every recoverable auth failure carries a machine-readable `code` so the web
 * can render localized, recovery-oriented copy (R112/R113 — every error is a
 * recovery; Arabic-first, R101). The English `message` is a developer/debug
 * fallback only — clients must branch on `code`, never on message text.
 *
 * Extra fields (e.g. `retryAfterMinutes` on LOCKED_OUT, `rules`/`failed` on
 * WEAK_PASSWORD) ride alongside so the UI can be specific without a second call.
 */
export type AuthErrorCode =
  // registration / identity
  | "EMAIL_TAKEN"
  | "PHONE_TAKEN"
  | "TERMS_NOT_ACCEPTED"
  | "PASSWORD_REQUIRED"
  | "WEAK_PASSWORD"
  // login
  | "BAD_CREDENTIALS"
  | "LOCKED_OUT"
  | "TOTP_REQUIRED"
  | "TOTP_INVALID"
  | "TOTP_NOT_SETUP"
  // one-time codes (SMS + email)
  | "OTP_EXPIRED"
  | "OTP_INVALID"
  | "OTP_RATE_LIMITED"
  // email verification state
  | "EMAIL_NOT_VERIFIED"
  | "EMAIL_ALREADY_VERIFIED"
  // account state
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_DEACTIVATED"
  // password reset + sessions
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "SESSION_EXPIRED"
  // federated sign-in
  | "GOOGLE_INVALID"
  | "GOOGLE_NOT_CONFIGURED";

export interface AuthErrorBody {
  code: AuthErrorCode;
  message: string;
  [key: string]: unknown;
}

/** Build a `{ code, message, ...extra }` body for a Nest HttpException. */
export function authError(
  code: AuthErrorCode,
  message: string,
  extra?: Record<string, unknown>
): AuthErrorBody {
  return { code, message, ...extra };
}
