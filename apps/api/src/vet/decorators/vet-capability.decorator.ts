import { SetMetadata } from "@nestjs/common";
import type { VetCapability as VetCapabilityKey } from "@moraqat/core";

export const VET_CAPABILITY_KEY = "vetCapability";

/**
 * Declares the clinic capability a route requires — MRC-VET-001 §14.
 *
 * Enforced by `VetStaffGuard` (the same guard that resolves the actor), which
 * runs `can()` from `@moraqat/core`. That is the whole point of the shared
 * matrix: the server's authorisation and the portal's "what do we even render"
 * are the *same function*, so a receptionist can never be shown a button that
 * a 403 will then take away.
 *
 * Multiple capabilities are treated as ALL-of — a route asking for
 * `record.write` and `prescription.write` needs both.
 *
 * @example
 * ```ts
 * @UseGuards(VetStaffGuard)
 * @VetCapability("record.write")
 * @Post("entries")
 * create(@VetActorParam() actor: VetActor) { … }
 * ```
 */
export const VetCapability = (...capabilities: VetCapabilityKey[]) =>
  SetMetadata(VET_CAPABILITY_KEY, capabilities);
