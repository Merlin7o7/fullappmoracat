import { SetMetadata } from "@nestjs/common";

/**
 * Marks a route (or whole controller) as a commercial / monetization surface.
 * While Community Mode is active (COMMERCE_ENABLED !== "true") the global
 * CommerceGuard hard-blocks these routes with a graceful 403 so no payment or
 * activation path is ever reachable.
 */
export const IS_COMMERCIAL_KEY = "isCommercial";
export const Commercial = () => SetMetadata(IS_COMMERCIAL_KEY, true);
