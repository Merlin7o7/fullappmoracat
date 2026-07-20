import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { VetCapability, VetRole } from "@moraqat/core";

/**
 * The resolved clinic-side identity for one request — MRC-VET-001 §02/§14.
 *
 * This is deliberately NOT the same thing as `req.user`. `req.user` answers
 * "who is this person?"; a VetActor answers "who are they *at this clinic,
 * right now, on this device?*". The same veterinarian may be an OWNER at their
 * own practice and a VET at the group they locum for, so every capability
 * decision is a property of the membership, never of the account.
 *
 * Populated by `VetStaffGuard` and read with `@VetActorParam()`.
 */
export interface VetActor {
  /** PartnerStaff.id — the membership row. Clinical authorship attributes here. */
  staffId: string;
  /** PartnerOrg.id resolved from the `x-moracat-org` header. */
  orgId: string;
  /**
   * True when this is a DEMO clinic.
   *
   * Drives a hard, two-way quarantine: a demo clinic sees only demo cats, and a
   * real clinic never sees them. Carried on the actor so the decision is local
   * to every query instead of an extra lookup that someone will forget.
   */
  orgIsDemo: boolean;
  /** User.id — the human behind the membership. */
  userId: string;
  /** Clinic role driving the capability matrix. */
  role: VetRole;
  /**
   * Branch scope. An EMPTY array means org-wide (every branch) — that is the
   * schema's convention (`PartnerStaff.branches` empty = no restriction), so
   * never treat `[]` as "no access".
   */
  branchIds: string[];
  /** True when this session was unlocked by PIN on a registered counter device. */
  counterMode: boolean;
  /** CounterDevice.id when `counterMode`, otherwise null. */
  deviceId: string | null;
  /**
   * Every capability this actor holds in this context, already narrowed for
   * counter mode. Resolved once by the guard so handlers and responses never
   * recompute (and never disagree with) the matrix.
   */
  capabilities: VetCapability[];
}

/** Request shape once `VetStaffGuard` has run. */
export interface VetRequest {
  vetActor?: VetActor;
}

/**
 * Injects the resolved {@link VetActor}. Only valid on routes protected by
 * `VetStaffGuard` — without it the guard never ran and there is no actor.
 */
export const VetActorParam = createParamDecorator(
  (data: keyof VetActor | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<VetRequest>();
    const actor = request.vetActor;
    if (!actor) {
      throw new Error(
        "VetActorParam used on a route without VetStaffGuard — no clinic actor was resolved."
      );
    }
    return data ? actor[data] : actor;
  }
);
