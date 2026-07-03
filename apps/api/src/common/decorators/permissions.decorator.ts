import { SetMetadata } from "@nestjs/common";

/**
 * Declares the permission keys (e.g. "orders.write") a route requires.
 * Enforced by PermissionsGuard, which also requires the user to be staff.
 */
export const PERMISSIONS_KEY = "requiredPermissions";
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
