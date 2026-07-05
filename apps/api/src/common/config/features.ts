/**
 * Central feature switches.
 *
 * Moracat launches in **Community Mode**: every *commercial* capability —
 * checkout, paid subscriptions, membership activation, and all payment
 * providers — is disabled. The community, Cat ID, and identity product ship
 * first to grow the userbase; monetization is flipped on later by setting
 * COMMERCE_ENABLED=true (and PAYMENTS_MODE=live).
 *
 * Defaulting to OFF is deliberate: a misconfigured or forgotten env var must
 * fail *closed* (no payments) rather than open.
 */
export function commerceEnabled(): boolean {
  return process.env.COMMERCE_ENABLED === "true";
}
