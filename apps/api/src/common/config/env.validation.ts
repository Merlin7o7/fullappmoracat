import { Logger } from "@nestjs/common";

/** Known placeholder secrets that must never reach production. */
const DEFAULT_SECRETS = new Set([
  "",
  "change-me-access-secret",
  "change-me-refresh-secret",
  "change-me-nextauth-secret",
  "mock-webhook-secret",
]);

/**
 * Fail fast in production on insecure configuration. An API that signs tokens
 * with a publicly-known default secret is a full auth bypass, so we refuse to
 * boot rather than run insecurely. No-op outside production so local dev stays
 * frictionless.
 */
export function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  const errors: string[] = [];

  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    const val = process.env[key];
    if (!val || DEFAULT_SECRETS.has(val)) {
      errors.push(`${key} is missing or set to a known default value.`);
    } else if (val.length < 32) {
      errors.push(`${key} is too short — need ≥32 chars, got ${val.length}.`);
    }
  }

  // Core infrastructure the app cannot function without in production. Missing
  // any of these used to fail only later, at request time (or silently — see
  // email below), stranding real users. Fail at boot instead.
  const required: Array<[string, string]> = [
    ["DATABASE_URL", "the database connection string"],
    ["NEXT_PUBLIC_SITE_URL", "the public site URL (drives CORS + links)"],
    ["S3_ENDPOINT", "object storage endpoint (cat photos)"],
    ["S3_BUCKET", "object storage bucket"],
    ["S3_ACCESS_KEY", "object storage access key"],
    ["S3_SECRET_KEY", "object storage secret key"],
    ["S3_PUBLIC_URL", "object storage public base URL"],
  ];
  for (const [key, what] of required) {
    if (!process.env[key]) errors.push(`${key} is missing — ${what}.`);
  }

  // Transactional email is on the critical signup path (email-verification OTP
  // gates the dashboard). Without a real provider the app would "succeed" while
  // silently dropping every message to the log, so members could never verify.
  const emailProvider = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
  if (emailProvider !== "resend" || !process.env.RESEND_API_KEY) {
    errors.push(
      "EMAIL_PROVIDER=resend and RESEND_API_KEY are required in production — " +
        "email-verification and password-reset must actually send."
    );
  }

  // Commerce must never run against the mock PSP with real customers.
  if (
    process.env.COMMERCE_ENABLED === "true" &&
    (process.env.PAYMENTS_MODE ?? "mock") !== "live"
  ) {
    errors.push(
      "COMMERCE_ENABLED=true requires PAYMENTS_MODE=live — the mock payment provider must never take real money."
    );
  }

  if (errors.length > 0) {
    const logger = new Logger("Bootstrap");
    errors.forEach((e) => logger.error(e));
    throw new Error(
      `Refusing to start: insecure production configuration —\n  - ${errors.join("\n  - ")}`
    );
  }
}
