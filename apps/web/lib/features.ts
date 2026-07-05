/**
 * Community Mode on the web — mirrors the API's COMMERCE_ENABLED. Default OFF:
 * memberships show as "Coming Soon" and every commercial CTA routes to the
 * launch/waitlist experience. Flip NEXT_PUBLIC_COMMERCE_ENABLED=true at launch.
 */
export function commerceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_COMMERCE_ENABLED === "true";
}
