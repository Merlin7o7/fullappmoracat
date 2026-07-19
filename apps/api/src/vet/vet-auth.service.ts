import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomUUID } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { capabilitiesFor, VET_ROLE_LABELS } from "@moraqat/core";
import type { VetRole } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { resolveJwtSecret } from "../common/config/secrets";
import { vetError, type CounterTokenPayload } from "./guards/vet-staff.guard";
import type { CounterUnlockDto } from "./dto/vet-auth.dto";

/**
 * A counter session lasts at most 12 hours — the dossier's rule that a shared
 * terminal must be re-warmed by a real credential once a shift (§02). The
 * 2-minute idle auto-lock is a client concern; this is the hard ceiling.
 */
const COUNTER_TTL_SECONDS = 12 * 60 * 60;
/** DeviceSession.deviceLabel prefix marking a session as a counter unlock. */
const COUNTER_LABEL = "vet-counter:";

/** PIN throttling — 5 wrong PINs then a 30-second cool-off (§02). */
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 30_000;

/** Invitations expire in 7 days, re-sendable and revocable (§02). */
export const INVITE_TTL_DAYS = 7;

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Clinic-side identity — MRC-VET-001 §02.
 *
 * There is deliberately NO parallel password system for clinics. A vet signs in
 * with their ordinary Moracat account; this service only answers the questions
 * that come *after* authentication: which clinics am I part of, which one am I
 * acting inside, and who is standing at the front desk right now.
 */
@Injectable()
export class VetAuthService {
  private readonly logger = new Logger("VetAuth");

  /**
   * Failed-PIN counters, keyed by device+staff. In-memory on purpose: a PIN is
   * a *convenience* factor on a physically controlled terminal whose session is
   * already authenticated, so a per-instance cool-off is the right weight. The
   * durable protections are the 12-hour ceiling and instant server-side revoke.
   */
  private readonly pinAttempts = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  // ── Org context ───────────────────────────────────────────────────────────

  /**
   * Every clinic this person belongs to, so the portal can pick one. Returned
   * bilingually because the org switcher is staff-facing chrome that still
   * obeys Arabic-first (R101).
   */
  async context(userId: string) {
    const memberships = await this.prisma.partnerStaff.findMany({
      // Uses @@index([userId]).
      where: { userId, status: { not: "OFFBOARDED" } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        status: true,
        title: true,
        joinedAt: true,
        pinHash: true,
        org: {
          select: {
            id: true,
            slug: true,
            nameEn: true,
            nameAr: true,
            logoUrl: true,
            status: true,
            verifiedAt: true,
            suspendedAt: true,
          },
        },
        branches: { select: { id: true, nameEn: true, nameAr: true } },
      },
    });

    return {
      memberships: memberships.map((m) => this.membershipView(m)),
      /** True when this account has no clinic identity at all. */
      isClinicStaff: memberships.length > 0,
    };
  }

  /**
   * Validate an org choice and hand back the context the portal will then send
   * as `x-moracat-org` on every request. The header is only ever a hint — the
   * guard re-proves membership per request, so this endpoint is a UX
   * convenience, never the security boundary.
   */
  async selectOrg(userId: string, orgId: string) {
    const membership = await this.prisma.partnerStaff.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: {
        id: true,
        role: true,
        status: true,
        title: true,
        joinedAt: true,
        pinHash: true,
        org: {
          select: {
            id: true,
            slug: true,
            nameEn: true,
            nameAr: true,
            logoUrl: true,
            status: true,
            verifiedAt: true,
            suspendedAt: true,
          },
        },
        branches: { select: { id: true, nameEn: true, nameAr: true } },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        vetError("VET_NOT_STAFF", "You are not a member of this clinic.", { orgId })
      );
    }
    if (membership.org.status === "SUSPENDED" || membership.org.suspendedAt) {
      throw new ForbiddenException(
        vetError("VET_ORG_SUSPENDED", "This clinic's access is suspended.", { orgId })
      );
    }
    if (membership.org.status !== "LIVE" && membership.org.status !== "APPROVED") {
      throw new ForbiddenException(
        vetError("VET_ORG_NOT_LIVE", "This clinic is not active on Moracat yet.", {
          orgId,
          status: membership.org.status,
        })
      );
    }
    if (membership.status === "SUSPENDED") {
      throw new ForbiddenException(
        vetError("VET_STAFF_SUSPENDED", "Your access to this clinic is suspended.")
      );
    }
    if (membership.status === "INVITED") {
      throw new ForbiddenException(
        vetError("VET_INVITE_PENDING", "Accept your invitation to start working at this clinic.")
      );
    }
    if (membership.status === "OFFBOARDED") {
      throw new ForbiddenException(vetError("VET_NOT_STAFF", "This clinic's access has ended."));
    }

    return {
      ...this.membershipView(membership),
      /** Echo the header the client must now send. */
      header: { name: "x-moracat-org", value: orgId },
    };
  }

  private membershipView(m: {
    id: string;
    role: string;
    status: string;
    title: string | null;
    joinedAt: Date | null;
    pinHash: string | null;
    org: {
      id: string;
      slug: string;
      nameEn: string;
      nameAr: string;
      logoUrl: string | null;
      status: string;
      verifiedAt: Date | null;
      suspendedAt: Date | null;
    };
    branches: { id: string; nameEn: string; nameAr: string }[];
  }) {
    const role = m.role as VetRole;
    return {
      staffId: m.id,
      role,
      roleLabel: VET_ROLE_LABELS[role],
      status: m.status,
      title: m.title,
      joinedAt: m.joinedAt,
      hasCounterPin: !!m.pinHash,
      org: {
        id: m.org.id,
        slug: m.org.slug,
        nameEn: m.org.nameEn,
        nameAr: m.org.nameAr,
        logoUrl: m.org.logoUrl,
        status: m.org.status,
        verified: !!m.org.verifiedAt,
        suspended: !!m.org.suspendedAt,
      },
      /** Empty = org-wide scope, matching the schema's convention. */
      branches: m.branches,
      capabilities: capabilitiesFor({ role }),
    };
  }

  // ── Invitations ───────────────────────────────────────────────────────────

  /**
   * Show the invitee what they are being asked to join *before* they sign in.
   * Public and read-only: an invite token proves nothing except that someone
   * emailed it, so this exposes only the clinic's public identity and the role.
   */
  async previewInvite(token: string) {
    const invite = await this.findLiveInvite(token);
    const role = invite.role as VetRole;
    return {
      orgName: { en: invite.org.nameEn, ar: invite.org.nameAr },
      orgLogoUrl: invite.org.logoUrl,
      email: invite.email,
      role,
      roleLabel: VET_ROLE_LABELS[role],
      expiresAt: invite.expiresAt,
    };
  }

  /**
   * Accept an invitation. The invitee must already be signed in to their own
   * Moracat account (individual accounts are non-negotiable — §02), and the
   * account's email must be the one that was invited, so a forwarded link can
   * never enrol a stranger.
   */
  async acceptInvite(userId: string, userEmail: string, token: string) {
    const invite = await this.findLiveInvite(token);

    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        vetError("VET_INVITE_EMAIL_MISMATCH", "This invitation was sent to a different email address.", {
          invitedEmail: maskEmail(invite.email),
        })
      );
    }
    if (invite.org.status === "SUSPENDED" || invite.org.suspendedAt) {
      throw new ForbiddenException(
        vetError("VET_ORG_SUSPENDED", "This clinic's access is suspended.")
      );
    }

    const now = new Date();
    const staff = await this.prisma.$transaction(async (tx) => {
      // A membership row may already exist (INVITED) from the invite, or from a
      // prior offboarding — either way, accepting activates it rather than
      // creating a duplicate, because @@unique([orgId, userId]) is the truth.
      const membership = await tx.partnerStaff.upsert({
        where: { orgId_userId: { orgId: invite.orgId, userId } },
        update: {
          role: invite.role,
          status: "ACTIVE",
          joinedAt: now,
          offboardedAt: null,
        },
        create: {
          orgId: invite.orgId,
          userId,
          role: invite.role,
          status: "ACTIVE",
          invitedById: invite.invitedById,
          joinedAt: now,
        },
        select: { id: true, role: true, orgId: true },
      });

      await tx.partnerInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: now },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "vet.staff.invite.accept",
          entityType: "PartnerStaff",
          entityId: membership.id,
          metadata: { orgId: invite.orgId, role: invite.role, inviteId: invite.id },
        },
      });

      return membership;
    });

    const role = staff.role as VetRole;
    return {
      staffId: staff.id,
      orgId: staff.orgId,
      role,
      roleLabel: VET_ROLE_LABELS[role],
      capabilities: capabilitiesFor({ role }),
      org: { nameEn: invite.org.nameEn, nameAr: invite.org.nameAr },
    };
  }

  /** Resolve a live (unaccepted, unrevoked, unexpired) invite from its raw token. */
  private async findLiveInvite(token: string) {
    const invite = await this.prisma.partnerInvite.findUnique({
      // tokenHash is @unique — a single indexed lookup, and the raw token is
      // never stored (an admin with database access still cannot replay it).
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        orgId: true,
        email: true,
        role: true,
        invitedById: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        org: {
          select: { nameEn: true, nameAr: true, logoUrl: true, status: true, suspendedAt: true },
        },
      },
    });

    if (!invite || invite.revokedAt) {
      throw new NotFoundException(
        vetError("VET_INVITE_INVALID", "This invitation is no longer valid.")
      );
    }
    if (invite.acceptedAt) {
      throw new BadRequestException(
        vetError("VET_INVITE_USED", "This invitation has already been used.")
      );
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        vetError("VET_INVITE_EXPIRED", "This invitation has expired — ask for a new one.")
      );
    }
    return invite;
  }

  // ── Counter mode ──────────────────────────────────────────────────────────

  /**
   * Swap the active clinical identity on a registered terminal (§02).
   *
   * The terminal already holds a warm, fully-authenticated session (that is the
   * caller's bearer token). This does NOT authenticate a new person from
   * scratch — a 4-digit PIN could never carry that weight. It attributes work
   * to a named colleague on a device a manager vouched for, and hands back a
   * token whose capabilities are deliberately *narrower* than the role's.
   */
  async counterUnlock(callerUserId: string, dto: CounterUnlockDto, meta: RequestMeta) {
    const device = await this.prisma.counterDevice.findUnique({
      where: { id: dto.deviceId },
      select: {
        id: true,
        name: true,
        revokedAt: true,
        branchId: true,
        branch: { select: { orgId: true, isActive: true } },
      },
    });
    if (!device || device.revokedAt || !device.branch.isActive) {
      throw new NotFoundException(
        vetError("VET_DEVICE_NOT_REGISTERED", "This terminal is not registered to a clinic.")
      );
    }
    const orgId = device.branch.orgId;

    // The person holding the warm session must themselves be active staff of
    // this org: a stolen device id cannot be unlocked from an outside account.
    const caller = await this.prisma.partnerStaff.findUnique({
      where: { orgId_userId: { orgId, userId: callerUserId } },
      select: { id: true, status: true },
    });
    if (!caller || caller.status !== "ACTIVE") {
      throw new ForbiddenException(
        vetError("VET_NOT_STAFF", "You are not active staff at this clinic.")
      );
    }

    const attemptKey = `${dto.deviceId}:${dto.staffId}`;
    const lockedFor = this.pinLockRemainingMs(attemptKey);
    if (lockedFor > 0) {
      throw new ForbiddenException(
        vetError("VET_PIN_LOCKED", "Too many attempts. Try again shortly.", {
          retryAfterSeconds: Math.ceil(lockedFor / 1000),
        })
      );
    }

    const staff = await this.prisma.partnerStaff.findUnique({
      where: { id: dto.staffId },
      select: {
        id: true,
        userId: true,
        orgId: true,
        role: true,
        status: true,
        title: true,
        pinHash: true,
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // One indistinguishable failure for "no such person", "wrong org", "no PIN"
    // and "wrong PIN" — the avatar rail is public to anyone at the counter, so
    // the PIN must not become an oracle for who works here.
    const pinOk =
      !!staff &&
      staff.orgId === orgId &&
      staff.status === "ACTIVE" &&
      !!staff.pinHash &&
      (await bcrypt.compare(dto.pin, staff.pinHash));

    if (!pinOk || !staff) {
      this.recordPinFailure(attemptKey);
      throw new UnauthorizedException(
        vetError("VET_PIN_INVALID", "That PIN doesn't match. Try again.")
      );
    }
    this.pinAttempts.delete(attemptKey);

    const expiresAt = new Date(Date.now() + COUNTER_TTL_SECONDS * 1000);

    // The session row is what makes "lock" instant and cluster-wide: the token
    // is only honoured while this row is live, so revoking beats token expiry.
    const session = await this.prisma.deviceSession.create({
      data: {
        userId: staff.userId,
        refreshHash: `counter:${randomUUID()}`,
        deviceLabel: `${COUNTER_LABEL}${device.id}`,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
      select: { id: true },
    });

    const payload: CounterTokenPayload = {
      typ: "vet_counter",
      sub: staff.userId,
      sid: session.id,
      staffId: staff.id,
      orgId,
      deviceId: device.id,
    };
    const token = await this.jwt.signAsync(payload, {
      secret: resolveJwtSecret("JWT_ACCESS_SECRET"),
      expiresIn: COUNTER_TTL_SECONDS,
    });

    await this.prisma.$transaction([
      this.prisma.counterDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: staff.userId,
          action: "vet.counter.unlock",
          entityType: "CounterDevice",
          entityId: device.id,
          metadata: { orgId, staffId: staff.id, unlockedByStaffId: caller.id },
          ipAddress: meta.ipAddress,
        },
      }),
    ]);

    const role = staff.role as VetRole;
    return {
      counterToken: token,
      expiresAt,
      header: { name: "x-moracat-counter", value: token },
      device: { id: device.id, name: device.name, branchId: device.branchId },
      actor: {
        staffId: staff.id,
        orgId,
        role,
        roleLabel: VET_ROLE_LABELS[role],
        title: staff.title,
        name: [staff.user.firstName, staff.user.lastName].filter(Boolean).join(" ") || null,
        avatarUrl: staff.user.avatarUrl,
        counterMode: true,
        // Narrowed by counter mode — the UI renders exactly this and nothing more.
        capabilities: capabilitiesFor({ role, counterMode: true }),
      },
    };
  }

  /** End a counter session immediately (auto-lock, shift change, or sign-out). */
  async counterLock(token: string | undefined, meta: RequestMeta) {
    if (!token) {
      throw new BadRequestException(
        vetError("VET_COUNTER_SESSION_INVALID", "No counter session to lock.")
      );
    }

    let payload: CounterTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<CounterTokenPayload>(token, {
        secret: resolveJwtSecret("JWT_ACCESS_SECRET"),
      });
    } catch {
      // Already expired is already locked — locking is idempotent by design so
      // a flaky network never leaves a terminal stuck holding an identity.
      return { locked: true };
    }
    if (payload?.typ !== "vet_counter" || !payload.sid) {
      throw new BadRequestException(
        vetError("VET_COUNTER_SESSION_INVALID", "That is not a counter session token.")
      );
    }

    await this.prisma.deviceSession.updateMany({
      where: { id: payload.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: payload.sub,
        action: "vet.counter.lock",
        entityType: "CounterDevice",
        entityId: payload.deviceId,
        metadata: { orgId: payload.orgId, staffId: payload.staffId },
        ipAddress: meta.ipAddress,
      },
    });

    return { locked: true };
  }

  /**
   * Revoke every live counter session for a staff member. Called when a person
   * is suspended or offboarded — the door must close on the shared iPad too,
   * not just on their laptop.
   */
  async revokeCounterSessionsForUser(userId: string): Promise<number> {
    const { count } = await this.prisma.deviceSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        deviceLabel: { startsWith: COUNTER_LABEL },
      },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  /** Revoke every counter session bound to one device (device revoked/renamed). */
  async revokeCounterSessionsForDevice(deviceId: string): Promise<number> {
    const { count } = await this.prisma.deviceSession.updateMany({
      where: { deviceLabel: `${COUNTER_LABEL}${deviceId}`, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  // ── PIN throttling ────────────────────────────────────────────────────────

  private pinLockRemainingMs(key: string): number {
    const entry = this.pinAttempts.get(key);
    if (!entry) return 0;
    const remaining = entry.lockedUntil - Date.now();
    if (remaining <= 0 && entry.lockedUntil > 0) {
      this.pinAttempts.delete(key);
      return 0;
    }
    return Math.max(0, remaining);
  }

  private recordPinFailure(key: string): void {
    const entry = this.pinAttempts.get(key) ?? { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= PIN_MAX_ATTEMPTS) {
      entry.lockedUntil = Date.now() + PIN_LOCKOUT_MS;
      entry.count = 0;
      this.logger.warn(`Counter PIN locked out for ${key} (${PIN_LOCKOUT_MS / 1000}s)`);
    }
    this.pinAttempts.set(key, entry);

    // Keep the map from growing without bound on a long-lived process.
    if (this.pinAttempts.size > 5_000) {
      const now = Date.now();
      for (const [k, v] of this.pinAttempts) {
        if (v.lockedUntil && v.lockedUntil < now) this.pinAttempts.delete(k);
      }
    }
  }
}

/** SHA-256 hex digest — invite tokens are high-entropy, so a fast digest is right. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** n***@domain — enough for "check your other inbox", never a disclosure. */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
