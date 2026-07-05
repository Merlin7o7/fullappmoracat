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
