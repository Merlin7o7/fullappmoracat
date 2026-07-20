import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { can, capabilitiesFor } from "@moraqat/core";
import type { VetCapability, VetRole } from "@moraqat/core";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveJwtSecret } from "../../common/config/secrets";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { VET_CAPABILITY_KEY } from "../decorators/vet-capability.decorator";
import type { VetActor } from "../decorators/vet-actor.decorator";

/** Header carrying the org the caller is acting inside (the portal's org switcher). */
export const VET_ORG_HEADER = "x-moracat-org";
/** Header carrying a counter-mode (PIN) session token, when one is active. */
export const VET_COUNTER_HEADER = "x-moracat-counter";

/**
 * Machine-readable failures for every way a clinic request can be refused.
 * Clients branch on `code`, never on `message` (R112/R113 — every error is a
 * recovery, and the portal renders it bilingually).
 */
export type VetErrorCode =
  // ── Access resolution (thrown by VetStaffGuard) ──
  | "VET_ORG_REQUIRED"
  | "VET_NOT_STAFF"
  | "VET_ORG_SUSPENDED"
  | "VET_ORG_NOT_LIVE"
  | "VET_STAFF_SUSPENDED"
  | "VET_INVITE_PENDING"
  | "VET_FORBIDDEN"
  // ── Counter mode ──
  | "VET_COUNTER_SESSION_INVALID"
  | "VET_COUNTER_SESSION_EXPIRED"
  | "VET_COUNTER_ORG_MISMATCH"
  | "VET_DEVICE_NOT_REGISTERED"
  | "VET_PIN_INVALID"
  | "VET_PIN_LOCKED"
  | "VET_PIN_NOT_SET"
  | "VET_PIN_CURRENT_REQUIRED"
  // ── Invitations ──
  | "VET_INVITE_INVALID"
  | "VET_INVITE_USED"
  | "VET_INVITE_EXPIRED"
  | "VET_INVITE_EMAIL_MISMATCH"
  | "VET_INVITE_ALREADY_STAFF"
  // ── Staff administration ──
  | "VET_STAFF_NOT_FOUND"
  | "VET_ROLE_NOT_ASSIGNABLE"
  | "VET_LAST_OWNER"
  | "VET_SELF_ACTION"
  // ── Org, branches, devices ──
  | "VET_BRANCH_NOT_FOUND"
  | "VET_DOCUMENT_NOT_FOUND"
  | "VET_CITY_INVALID"
  | "VET_VAT_TAKEN"
  // ── Applications (public + admin) ──
  | "VET_APPLICATION_NOT_FOUND"
  | "VET_APPLICATION_DUPLICATE"
  | "VET_APPLICATION_NOT_PENDING"
  | "VET_ORG_NOT_FOUND"
  | "VET_ORG_SLUG_TAKEN"
  | "VET_ORG_CR_TAKEN";

export interface VetErrorBody {
  code: VetErrorCode;
  message: string;
  [key: string]: unknown;
}

/** Build a `{ code, message, …extra }` body for a Nest HttpException. */
export function vetError(
  code: VetErrorCode,
  message: string,
  extra?: Record<string, unknown>
): VetErrorBody {
  return { code, message, ...extra };
}

/** Claims carried by a counter-mode session token (see VetAuthService). */
export interface CounterTokenPayload {
  typ: "vet_counter";
  /** User.id of the PIN'd staff member. */
  sub: string;
  /** DeviceSession.id backing this counter session (revocable server-side). */
  sid: string;
  staffId: string;
  orgId: string;
  deviceId: string;
}

/** Org statuses a staff member may actually work inside. */
const WORKABLE_ORG_STATUSES = new Set(["LIVE", "APPROVED"]);

/**
 * Resolves — and gates — the clinic-side identity for a request (MRC-VET-001
 * §02/§14).
 *
 * Runs *after* the global `JwtAuthGuard`, so `req.user` is already the
 * authenticated human. This guard answers the second question: which clinic are
 * they acting inside, in what role, and on what kind of device?
 *
 * Two resolution paths:
 *
 *  1. **Personal session** — `x-moracat-org: <orgId>` selects the org. The JWT
 *     is the shared Moracat token (there is deliberately no parallel password
 *     system for clinics), so org selection is a *validated request-scoped
 *     resolution*: the header is only ever a hint, and membership is proven
 *     against the database on every single request. A forged header buys
 *     nothing.
 *  2. **Counter mode** — `x-moracat-counter: <token>` from a PIN unlock on a
 *     registered terminal. The actor becomes the PIN'd staff member and
 *     `counterMode` is set, which *removes* capabilities (exports, settings,
 *     staff/branch/device management, billing writes) whatever the role. A
 *     shared iPad is never a full session.
 *
 * It also enforces `@VetCapability(...)` in the same pass, so a consuming
 * controller needs exactly one `@UseGuards(VetStaffGuard)`.
 */
@Injectable()
export class VetStaffGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
      vetActor?: VetActor;
    }>();

    const user = req.user;
    if (!user) throw new UnauthorizedException("Authentication required");

    const counterToken = header(req.headers, VET_COUNTER_HEADER);
    const actor = counterToken
      ? await this.resolveCounterActor(counterToken, header(req.headers, VET_ORG_HEADER))
      : await this.resolvePersonalActor(user.id, header(req.headers, VET_ORG_HEADER));

    req.vetActor = actor;

    // Capability enforcement, same pass — handler metadata wins over class.
    const required = this.reflector.getAllAndOverride<VetCapability[]>(VET_CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length) {
      const missing = required.filter(
        (capability) => !can({ role: actor.role, counterMode: actor.counterMode }, capability)
      );
      if (missing.length > 0) {
        throw new ForbiddenException(
          vetError(
            "VET_FORBIDDEN",
            `Your role does not include: ${missing.join(", ")}`,
            {
              // Named so the portal can say "Ask <manager> — or change your
              // role", rather than a bare "denied" (§18 error register).
              missing,
              capability: missing[0],
              role: actor.role,
              counterMode: actor.counterMode,
            }
          )
        );
      }
    }

    return true;
  }

  /** Path 1: a personal session picking an org via header. */
  private async resolvePersonalActor(userId: string, orgId: string | null): Promise<VetActor> {
    if (!orgId) {
      throw new ForbiddenException(
        vetError(
          "VET_ORG_REQUIRED",
          `Send the ${VET_ORG_HEADER} header to choose which clinic you are acting for.`
        )
      );
    }

    // Single indexed read on PartnerStaff's @@unique([orgId, userId]).
    const staff = await this.prisma.partnerStaff.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: {
        id: true,
        userId: true,
        orgId: true,
        role: true,
        status: true,
        org: { select: { status: true, suspendedAt: true, isDemo: true } },
        branches: { select: { id: true } },
      },
    });

    if (!staff) {
      throw new ForbiddenException(
        vetError("VET_NOT_STAFF", "You are not a member of this clinic.", { orgId })
      );
    }

    this.assertOrgWorkable(staff.org.status, staff.org.suspendedAt, orgId);
    this.assertStaffActive(staff.status);

    return this.buildActor({
      staffId: staff.id,
      orgId: staff.orgId,
      // Two-way demo quarantine — see VetActor.orgIsDemo.
      orgIsDemo: staff.org.isDemo,
      userId: staff.userId,
      role: staff.role as VetRole,
      branchIds: staff.branches.map((b) => b.id),
      counterMode: false,
      deviceId: null,
    });
  }

  /** Path 2: a PIN-unlocked identity on a registered terminal. */
  private async resolveCounterActor(token: string, headerOrgId: string | null): Promise<VetActor> {
    let payload: CounterTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<CounterTokenPayload>(token, {
        secret: resolveJwtSecret("JWT_COUNTER_SECRET"),
      });
    } catch {
      throw new UnauthorizedException(
        vetError("VET_COUNTER_SESSION_EXPIRED", "The counter session has ended. Tap your name to unlock again.")
      );
    }
    if (payload?.typ !== "vet_counter" || !payload.sid || !payload.staffId) {
      throw new UnauthorizedException(
        vetError("VET_COUNTER_SESSION_INVALID", "That is not a valid counter session token.")
      );
    }

    // A header naming a different org than the token would be an attempt to
    // carry a front-desk identity somewhere it was never unlocked for.
    if (headerOrgId && headerOrgId !== payload.orgId) {
      throw new ForbiddenException(
        vetError(
          "VET_COUNTER_ORG_MISMATCH",
          "This counter session belongs to a different clinic."
        )
      );
    }

    // The token alone is not enough: the backing session must still be live, so
    // "lock" (and offboarding) revoke instantly across every API instance.
    const [session, staff, device] = await Promise.all([
      this.prisma.deviceSession.findUnique({
        where: { id: payload.sid },
        select: { id: true, revokedAt: true, expiresAt: true },
      }),
      this.prisma.partnerStaff.findUnique({
        where: { id: payload.staffId },
        select: {
          id: true,
          userId: true,
          orgId: true,
          role: true,
          status: true,
          org: { select: { status: true, suspendedAt: true, isDemo: true } },
          branches: { select: { id: true } },
        },
      }),
      this.prisma.counterDevice.findUnique({
        where: { id: payload.deviceId },
        select: { id: true, revokedAt: true, branch: { select: { orgId: true } } },
      }),
    ]);

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(
        vetError("VET_COUNTER_SESSION_EXPIRED", "The counter session has ended. Tap your name to unlock again.")
      );
    }
    if (!device || device.revokedAt || device.branch.orgId !== payload.orgId) {
      throw new UnauthorizedException(
        vetError("VET_COUNTER_SESSION_INVALID", "This terminal is no longer registered to the clinic.")
      );
    }
    if (!staff || staff.orgId !== payload.orgId) {
      throw new ForbiddenException(
        vetError("VET_NOT_STAFF", "That membership no longer exists at this clinic.")
      );
    }

    this.assertOrgWorkable(staff.org.status, staff.org.suspendedAt, staff.orgId);
    this.assertStaffActive(staff.status);

    return this.buildActor({
      staffId: staff.id,
      orgId: staff.orgId,
      // Two-way demo quarantine — see VetActor.orgIsDemo.
      orgIsDemo: staff.org.isDemo,
      userId: staff.userId,
      role: staff.role as VetRole,
      branchIds: staff.branches.map((b) => b.id),
      counterMode: true,
      deviceId: device.id,
    });
  }

  private assertOrgWorkable(status: string, suspendedAt: Date | null, orgId: string): void {
    if (status === "SUSPENDED" || suspendedAt) {
      throw new ForbiddenException(
        vetError(
          "VET_ORG_SUSPENDED",
          "This clinic's access is suspended. Moracat support can restore it.",
          { orgId }
        )
      );
    }
    if (!WORKABLE_ORG_STATUSES.has(status)) {
      throw new ForbiddenException(
        vetError(
          "VET_ORG_NOT_LIVE",
          "This clinic is not active on Moracat yet.",
          { orgId, status }
        )
      );
    }
  }

  private assertStaffActive(status: string): void {
    if (status === "ACTIVE") return;
    if (status === "SUSPENDED") {
      throw new ForbiddenException(
        vetError("VET_STAFF_SUSPENDED", "Your access to this clinic is suspended.")
      );
    }
    if (status === "INVITED") {
      throw new ForbiddenException(
        vetError("VET_INVITE_PENDING", "Accept your invitation to start working at this clinic.")
      );
    }
    // OFFBOARDED — the person's name stays on historical records, but the door
    // is closed (§02: offboarding never orphans a record).
    throw new ForbiddenException(
      vetError("VET_NOT_STAFF", "This clinic's access has ended.")
    );
  }

  private buildActor(base: Omit<VetActor, "capabilities">): VetActor {
    return {
      ...base,
      capabilities: capabilitiesFor({ role: base.role, counterMode: base.counterMode }),
    };
  }
}

/** Read a single-valued header, trimmed; null when absent or blank. */
function header(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const raw = headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
