import { SetMetadata } from "@nestjs/common";

/**
 * Marks a route as usable both anonymously and authenticated.
 *
 * Unlike `@Public()`, a valid bearer token is still parsed and `req.user` is
 * populated — the route simply does not *require* one. An invalid or expired
 * token is treated as anonymous rather than rejected, so a stale session never
 * hard-fails a guest-capable flow.
 *
 * Used by the cart, where an anonymous shopper holds a capability token and an
 * authenticated shopper owns the cart outright, and the handler must be able to
 * tell the two apart to enforce ownership and to claim a guest cart on login.
 */
export const IS_OPTIONAL_AUTH_KEY = "isOptionalAuth";
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
