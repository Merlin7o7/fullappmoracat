import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { Prisma } from "@moraqat/db";
import { assignableRoles, capabilitiesFor, VET_ROLE_LABELS } from "@moraqat/core";
import type { VetRole } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { vetError } from "./guards/vet-staff.guard";
import type { VetActor } from "./decorators/vet-actor.decorator";
import { hashToken, INVITE_TTL_DAYS, VetAuthService, type RequestMeta } from "./vet-auth.service";
import type {
  ChangeStaffRoleDto,
  InviteStaffDto,
  SetOwnPinDto,
  StaffListQueryDto,
  StaffReasonDto,
} from "./dto/vet-staff.dto";

const DEFAULT_LIMIT = 25;

/**
 * Clinic staff administration — MRC-VET-001 §02/§14.
 *
 * The governing idea: individual accounts must be *cheaper* than sharing one.
 * Inviting a colleague is a 20-second act, and every destructive action
 * (suspend, offboard, role change) is reversible-by-design and audited, so a
 * manager never hesitates. Nobody can escalate past themselves — `assignableRoles`
 * from the shared matrix is the only authority on who may hand out what.
 */
@Injectable()
export class VetStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly vetAuth: VetAuthService
  ) {}

  // ── Reads ─────────────────────────────────────────────────────────────────

  async list(actor: VetActor, query: StaffListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.PartnerStaffWhereInput = {
      // Hits @@index([orgId, status]).
      orgId: actor.orgId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            user: {
              OR: [
                { firstName: { contains: query.q, mode: "insensitive" as const } },
                { lastName: { contains: query.q, mode: "insensitive" as const } },
                { email: { contains: query.q, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.partnerStaff.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          role: true,
          status: true,
          title: true,
          licenceNo: true,
          pinHash: true,
          joinedAt: true,
          offboardedAt: true,
          createdAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          branches: { select: { id: true, nameEn: true, nameAr: true } },
        },
      }),
      this.prisma.partnerStaff.count({ where }),
    ]);

    return {
      items: rows.map((s) => {
        const role = s.role as VetRole;
        return {
          id: s.id,
          role,
          roleLabel: VET_ROLE_LABELS[role],
          status: s.status,
          title: s.title,
          licenceNo: s.licenceNo,
          hasCounterPin: !!s.pinHash,
          joinedAt: s.joinedAt,
          offboardedAt: s.offboardedAt,
          createdAt: s.createdAt,
          isSelf: s.id === actor.staffId,
          user: {
            id: s.user.id,
            name: [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") || null,
            email: s.user.email,
            avatarUrl: s.user.avatarUrl,
          },
          /** Empty = every branch in the org. */
          branches: s.branches,
          capabilities: capabilitiesFor({ role }),
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Which roles this actor may hand out — the UI renders exactly this list. */
  assignable(actor: VetActor) {
    const roles = assignableRoles(actor.role);
    return {
      roles: roles.map((role) => ({
        role,
        label: VET_ROLE_LABELS[role],
        capabilities: capabilitiesFor({ role }),
      })),
    };
  }

  async listInvites(actor: VetActor) {
    const invites = await this.prisma.partnerInvite.findMany({
      // Hits @@index([orgId]).
      where: { orgId: actor.orgId, acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });
    return {
      items: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role as VetRole,
        roleLabel: VET_ROLE_LABELS[i.role as VetRole],
        expiresAt: i.expiresAt,
        expired: i.expiresAt.getTime() < Date.now(),
        createdAt: i.createdAt,
        invitedBy:
          [i.invitedBy?.firstName, i.invitedBy?.lastName].filter(Boolean).join(" ") || null,
      })),
    };
  }

  // ── Invitations ───────────────────────────────────────────────────────────

  async invite(actor: VetActor, dto: InviteStaffDto, meta: RequestMeta) {
    this.assertCanAssign(actor, dto.role);
    if (dto.branchIds?.length) await this.assertBranchesInOrg(actor, dto.branchIds);

    const result = await this.createInvite({
      orgId: actor.orgId,
      email: dto.email,
      role: dto.role,
      invitedByUserId: actor.userId,
      branchIds: dto.branchIds,
      title: dto.title,
    });

    await this.audit(actor, "vet.staff.invite", "PartnerInvite", result.inviteId, meta, {
      orgId: actor.orgId,
      email: dto.email.toLowerCase(),
      role: dto.role,
    });
    return result;
  }

  /**
   * Mint an invitation and email it. Shared by the clinic's own staff screen and
   * by Moracat admin at approval time (the first OWNER gets exactly this email),
   * so there is one invitation flow in the product, not two that drift.
   *
   * Callers that are not clinic staff (admin approval) pass no actor and are
   * responsible for their own authorisation.
   */
  async createInvite(params: {
    orgId: string;
    email: string;
    role: VetRole;
    invitedByUserId?: string | null;
    branchIds?: string[];
    title?: string;
    /** Prisma transaction client, when the invite is part of a larger commit. */
    tx?: Prisma.TransactionClient;
  }) {
    const db = params.tx ?? this.prisma;
    const email = params.email.toLowerCase().trim();

    const org = await db.partnerOrg.findUnique({
      where: { id: params.orgId },
      select: { id: true, nameEn: true, nameAr: true, logoUrl: true },
    });
    if (!org) {
      throw new NotFoundException(vetError("VET_ORG_NOT_FOUND", "Clinic not found."));
    }

    // Someone already working here does not need an invitation.
    const existing = await db.partnerStaff.findFirst({
      where: { orgId: params.orgId, user: { email }, status: { in: ["ACTIVE", "SUSPENDED"] } },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new ConflictException(
        vetError("VET_INVITE_ALREADY_STAFF", "That person is already on this clinic's team.")
      );
    }

    // Supersede any outstanding invite for the same address, so a re-invite is
    // simply "send it again" rather than a pile of live tokens.
    await db.partnerInvite.updateMany({
      where: { orgId: params.orgId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    const invite = await db.partnerInvite.create({
      data: {
        orgId: params.orgId,
        email,
        role: params.role,
        tokenHash: hashToken(token),
        invitedById: params.invitedByUserId ?? null,
        expiresAt,
      },
      select: { id: true },
    });

    // Pre-create the membership as INVITED so branch scope and title are ready
    // the instant they accept — and so the team list shows them as pending.
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await db.partnerStaff.upsert({
        where: { orgId_userId: { orgId: params.orgId, userId: user.id } },
        update: {
          role: params.role,
          status: "INVITED",
          offboardedAt: null,
          ...(params.title !== undefined ? { title: params.title } : {}),
          ...(params.branchIds
            ? { branches: { set: params.branchIds.map((id) => ({ id })) } }
            : {}),
        },
        create: {
          orgId: params.orgId,
          userId: user.id,
          role: params.role,
          status: "INVITED",
          invitedById: params.invitedByUserId ?? null,
          title: params.title ?? null,
          ...(params.branchIds?.length
            ? { branches: { connect: params.branchIds.map((id) => ({ id })) } }
            : {}),
        },
      });
    }

    await this.sendInviteEmail({ email, token, role: params.role, org });

    return { inviteId: invite.id, email, role: params.role, expiresAt };
  }

  async revokeInvite(actor: VetActor, inviteId: string, meta: RequestMeta) {
    const invite = await this.prisma.partnerInvite.findFirst({
      where: { id: inviteId, orgId: actor.orgId },
      select: { id: true, email: true, role: true, acceptedAt: true },
    });
    if (!invite) {
      throw new NotFoundException(vetError("VET_INVITE_INVALID", "Invitation not found."));
    }
    if (invite.acceptedAt) {
      throw new BadRequestException(
        vetError("VET_INVITE_USED", "That invitation has already been accepted.")
      );
    }
    this.assertCanAssign(actor, invite.role as VetRole);

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerInvite.update({
        where: { id: inviteId },
        data: { revokedAt: new Date() },
      });
      // Clean up the pending membership placeholder, if one was created.
      await tx.partnerStaff.deleteMany({
        where: { orgId: actor.orgId, status: "INVITED", user: { email: invite.email } },
      });
    });

    await this.audit(actor, "vet.staff.invite.revoke", "PartnerInvite", inviteId, meta, {
      orgId: actor.orgId,
      email: invite.email,
    });
    return { revoked: true };
  }

  async resendInvite(actor: VetActor, inviteId: string, meta: RequestMeta) {
    const invite = await this.prisma.partnerInvite.findFirst({
      where: { id: inviteId, orgId: actor.orgId },
      select: { id: true, email: true, role: true, acceptedAt: true, revokedAt: true },
    });
    if (!invite || invite.revokedAt) {
      throw new NotFoundException(vetError("VET_INVITE_INVALID", "Invitation not found."));
    }
    if (invite.acceptedAt) {
      throw new BadRequestException(
        vetError("VET_INVITE_USED", "That invitation has already been accepted.")
      );
    }
    this.assertCanAssign(actor, invite.role as VetRole);

    // Re-issue rather than resend: the old token dies, so a forwarded email from
    // last week can never be the one that gets used.
    const result = await this.createInvite({
      orgId: actor.orgId,
      email: invite.email,
      role: invite.role as VetRole,
      invitedByUserId: actor.userId,
    });

    await this.audit(actor, "vet.staff.invite.resend", "PartnerInvite", result.inviteId, meta, {
      orgId: actor.orgId,
      email: invite.email,
      supersededInviteId: inviteId,
    });
    return result;
  }

  // ── Membership changes ────────────────────────────────────────────────────

  async changeRole(actor: VetActor, staffId: string, dto: ChangeStaffRoleDto, meta: RequestMeta) {
    const target = await this.loadTarget(actor, staffId);
    this.assertNotSelf(actor, target.id, "change your own role");
    this.assertCanAssign(actor, dto.role);
    this.assertCanManage(actor, target.role as VetRole);
    if (dto.branchIds?.length) await this.assertBranchesInOrg(actor, dto.branchIds);

    if (target.role === "OWNER" && dto.role !== "OWNER") {
      await this.assertNotLastOwner(actor.orgId, target.id);
    }

    const updated = await this.prisma.partnerStaff.update({
      where: { id: staffId },
      data: {
        role: dto.role,
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.licenceNo !== undefined ? { licenceNo: dto.licenceNo } : {}),
        ...(dto.branchIds
          ? { branches: { set: dto.branchIds.map((id) => ({ id })) } }
          : {}),
      },
      select: { id: true, role: true, title: true, licenceNo: true },
    });

    // A narrower role must not keep a wider counter session alive.
    await this.vetAuth.revokeCounterSessionsForUser(target.userId);

    await this.audit(actor, "vet.staff.role.change", "PartnerStaff", staffId, meta, {
      orgId: actor.orgId,
      from: target.role,
      to: dto.role,
    });

    const role = updated.role as VetRole;
    return { ...updated, role, roleLabel: VET_ROLE_LABELS[role], capabilities: capabilitiesFor({ role }) };
  }

  async suspend(actor: VetActor, staffId: string, dto: StaffReasonDto, meta: RequestMeta) {
    const target = await this.loadTarget(actor, staffId);
    this.assertNotSelf(actor, target.id, "suspend yourself");
    this.assertCanManage(actor, target.role as VetRole);
    if (target.role === "OWNER") await this.assertNotLastOwner(actor.orgId, target.id);

    await this.prisma.partnerStaff.update({
      where: { id: staffId },
      data: { status: "SUSPENDED" },
    });
    const killed = await this.vetAuth.revokeCounterSessionsForUser(target.userId);

    await this.audit(actor, "vet.staff.suspend", "PartnerStaff", staffId, meta, {
      orgId: actor.orgId,
      reason: dto.reason ?? null,
      counterSessionsRevoked: killed,
    });
    return { id: staffId, status: "SUSPENDED" };
  }

  async reactivate(actor: VetActor, staffId: string, meta: RequestMeta) {
    const target = await this.loadTarget(actor, staffId);
    this.assertCanManage(actor, target.role as VetRole);
    if (target.status === "OFFBOARDED") {
      throw new BadRequestException(
        vetError(
          "VET_STAFF_NOT_FOUND",
          "That person was offboarded — invite them again to bring them back."
        )
      );
    }

    await this.prisma.partnerStaff.update({
      where: { id: staffId },
      data: { status: "ACTIVE", joinedAt: target.joinedAt ?? new Date() },
    });
    await this.audit(actor, "vet.staff.reactivate", "PartnerStaff", staffId, meta, {
      orgId: actor.orgId,
    });
    return { id: staffId, status: "ACTIVE" };
  }

  /**
   * Offboard: one action closes every door — login to this org, counter PIN,
   * live terminal sessions — while their name stays on every record they
   * authored. Records are never orphaned (§02); history is not a privilege.
   */
  async offboard(actor: VetActor, staffId: string, dto: StaffReasonDto, meta: RequestMeta) {
    const target = await this.loadTarget(actor, staffId);
    this.assertNotSelf(actor, target.id, "offboard yourself");
    this.assertCanManage(actor, target.role as VetRole);
    if (target.role === "OWNER") await this.assertNotLastOwner(actor.orgId, target.id);

    await this.prisma.partnerStaff.update({
      where: { id: staffId },
      data: {
        status: "OFFBOARDED",
        offboardedAt: new Date(),
        // The PIN dies with the membership — a shared terminal must forget them.
        pinHash: null,
        branches: { set: [] },
      },
    });
    const killed = await this.vetAuth.revokeCounterSessionsForUser(target.userId);

    await this.audit(actor, "vet.staff.offboard", "PartnerStaff", staffId, meta, {
      orgId: actor.orgId,
      reason: dto.reason ?? null,
      counterSessionsRevoked: killed,
    });
    return { id: staffId, status: "OFFBOARDED" };
  }

  // ── Counter PINs ──────────────────────────────────────────────────────────

  /**
   * Set or change your own counter PIN. Only ever done from a *personal*
   * session — a PIN set at the shared terminal would be a PIN everyone saw.
   */
  async setOwnPin(actor: VetActor, dto: SetOwnPinDto, meta: RequestMeta) {
    if (actor.counterMode) {
      throw new ForbiddenException(
        vetError(
          "VET_FORBIDDEN",
          "Set your PIN from your own device, not from a shared terminal.",
          { capability: "settings.manage" }
        )
      );
    }

    const staff = await this.prisma.partnerStaff.findUnique({
      where: { id: actor.staffId },
      select: { id: true, pinHash: true },
    });
    if (!staff) {
      throw new NotFoundException(vetError("VET_STAFF_NOT_FOUND", "Membership not found."));
    }

    // Replacing an existing PIN requires proving you know it.
    if (staff.pinHash) {
      if (!dto.currentPin) {
        throw new BadRequestException(
          vetError("VET_PIN_CURRENT_REQUIRED", "Enter your current PIN to change it.")
        );
      }
      const ok = await bcrypt.compare(dto.currentPin, staff.pinHash);
      if (!ok) {
        throw new ForbiddenException(vetError("VET_PIN_INVALID", "That current PIN is not right."));
      }
    }

    await this.prisma.partnerStaff.update({
      where: { id: actor.staffId },
      data: { pinHash: await bcrypt.hash(dto.pin, 12) },
    });
    await this.audit(actor, "vet.staff.pin.set", "PartnerStaff", actor.staffId, meta, {
      orgId: actor.orgId,
      replaced: !!staff.pinHash,
    });
    return { hasCounterPin: true };
  }

  /**
   * Clear someone's PIN (forgotten, or they left the front desk). A manager can
   * only ever *remove* a PIN, never set one — nobody should know a colleague's
   * PIN, including the person who manages them.
   */
  async resetPin(actor: VetActor, staffId: string, meta: RequestMeta) {
    const target = await this.loadTarget(actor, staffId);
    this.assertCanManage(actor, target.role as VetRole);

    await this.prisma.partnerStaff.update({
      where: { id: staffId },
      data: { pinHash: null },
    });
    const killed = await this.vetAuth.revokeCounterSessionsForUser(target.userId);

    await this.audit(actor, "vet.staff.pin.reset", "PartnerStaff", staffId, meta, {
      orgId: actor.orgId,
      counterSessionsRevoked: killed,
    });
    return {
      hasCounterPin: false,
      message: {
        en: "PIN cleared. They can set a new one from their own account.",
        ar: "تم مسح الرمز. يمكنه تعيين رمز جديد من حسابه.",
      },
    };
  }

  // ── Guards & helpers ──────────────────────────────────────────────────────

  private async loadTarget(actor: VetActor, staffId: string) {
    const target = await this.prisma.partnerStaff.findFirst({
      where: { id: staffId, orgId: actor.orgId },
      select: { id: true, userId: true, role: true, status: true, joinedAt: true },
    });
    if (!target) {
      throw new NotFoundException(
        vetError("VET_STAFF_NOT_FOUND", "That person is not on this clinic's team.")
      );
    }
    return target;
  }

  /** Nobody escalates past themselves — the matrix decides, not the caller. */
  private assertCanAssign(actor: VetActor, role: VetRole) {
    if (!assignableRoles(actor.role).includes(role)) {
      throw new ForbiddenException(
        vetError(
          "VET_ROLE_NOT_ASSIGNABLE",
          `Your role cannot assign ${VET_ROLE_LABELS[role].en}.`,
          { role, assignable: assignableRoles(actor.role) }
        )
      );
    }
  }

  /** You may only administer people whose role you could have granted. */
  private assertCanManage(actor: VetActor, targetRole: VetRole) {
    if (actor.role === "OWNER") return;
    if (!assignableRoles(actor.role).includes(targetRole)) {
      throw new ForbiddenException(
        vetError(
          "VET_ROLE_NOT_ASSIGNABLE",
          `Your role cannot manage a ${VET_ROLE_LABELS[targetRole].en}.`,
          { targetRole }
        )
      );
    }
  }

  private assertNotSelf(actor: VetActor, staffId: string, what: string) {
    if (actor.staffId === staffId) {
      throw new BadRequestException(
        vetError("VET_SELF_ACTION", `You cannot ${what}. Ask another owner or manager.`)
      );
    }
  }

  /** A clinic must never be left without an owner who can let anyone back in. */
  private async assertNotLastOwner(orgId: string, staffId: string) {
    const owners = await this.prisma.partnerStaff.count({
      where: { orgId, role: "OWNER", status: "ACTIVE", id: { not: staffId } },
    });
    if (owners === 0) {
      throw new BadRequestException(
        vetError(
          "VET_LAST_OWNER",
          "This is the clinic's only owner. Make someone else an owner first."
        )
      );
    }
  }

  private async assertBranchesInOrg(actor: VetActor, branchIds: string[]) {
    const found = await this.prisma.branch.count({
      where: { id: { in: branchIds }, orgId: actor.orgId },
    });
    if (found !== new Set(branchIds).size) {
      throw new BadRequestException(
        vetError("VET_BRANCH_NOT_FOUND", "One or more of those branches is not in your clinic.")
      );
    }
  }

  private async audit(
    actor: VetActor,
    action: string,
    entityType: string,
    entityId: string,
    meta: RequestMeta,
    metadata: Record<string, unknown>
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId: actor.userId,
        action,
        entityType,
        entityId,
        metadata: {
          ...metadata,
          actorStaffId: actor.staffId,
          actorRole: actor.role,
        } as Prisma.InputJsonValue,
        ipAddress: meta.ipAddress,
      },
    });
  }

  // ── The invitation email ──────────────────────────────────────────────────

  private async sendInviteEmail(params: {
    email: string;
    token: string;
    role: VetRole;
    org: { nameEn: string; nameAr: string; logoUrl: string | null };
  }) {
    const url = `${siteUrl()}/vet/invite?token=${encodeURIComponent(params.token)}`;
    const label = VET_ROLE_LABELS[params.role];
    const built = buildVetInviteEmail({
      orgNameAr: params.org.nameAr,
      orgNameEn: params.org.nameEn,
      logoUrl: params.org.logoUrl,
      roleAr: label.ar,
      roleEn: label.en,
      url,
    });

    await this.mail.send({
      to: params.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });
  }
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

// ════════════════════════════════════════════════════════════════════════════
//  Invitation email — bilingual, Arabic first (R101), inline-styled for
//  email-client safety, one unmistakable action. Built here rather than in
//  mail.templates.ts so the veterinary surface owns its own copy.
// ════════════════════════════════════════════════════════════════════════════

const BRAND = {
  paper: "#faf7f1",
  card: "#ffffff",
  ink: "#14261f",
  muted: "#5c665f",
  green: "#045b46",
  greenInk: "#f6f4ec",
  accent: "#f86c2f",
  accentInk: "#14261f",
  hairline: "#ece5d8",
  chipBg: "#f2ede2",
};

export function buildVetInviteEmail(p: {
  orgNameAr: string;
  orgNameEn: string;
  logoUrl: string | null;
  roleAr: string;
  roleEn: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const subject = `دعوة للانضمام إلى ${p.orgNameAr} على مُراقط · Join ${p.orgNameEn} on Moracat`;

  const logo = p.logoUrl
    ? `<img src="${escapeHtml(p.logoUrl)}" alt="" width="56" height="56" style="display:block;border-radius:12px;border:1px solid ${BRAND.hairline};" />`
    : "";

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.paper};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.hairline};border-radius:18px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;">

        <tr><td style="background:${BRAND.green};padding:22px 28px;color:${BRAND.greenInk};font-size:15px;font-weight:600;letter-spacing:.02em;">
          مُراقط · Moracat
        </td></tr>

        <!-- Arabic first: the default experience (R101). -->
        <tr><td dir="rtl" align="right" style="padding:28px 28px 8px;color:${BRAND.ink};">
          ${logo ? `<div style="margin-bottom:14px;">${logo}</div>` : ""}
          <h1 style="margin:0 0 10px;font-size:21px;line-height:1.4;font-weight:700;">تمت دعوتك للانضمام إلى ${escapeHtml(p.orgNameAr)}</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.75;color:${BRAND.muted};">
            ستنضم بصفة
            <span style="display:inline-block;background:${BRAND.chipBg};color:${BRAND.ink};border-radius:999px;padding:2px 10px;font-weight:600;">${escapeHtml(p.roleAr)}</span>.
            حسابك خاص بك وحدك — كل إجراء طبي يُنسب إلى اسمك، وهذا ما يجعل السجل موثوقًا.
          </p>
        </td></tr>

        <tr><td align="center" style="padding:18px 28px 6px;">
          <a href="${escapeHtml(p.url)}" style="display:inline-block;background:${BRAND.accent};color:${BRAND.accentInk};text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:12px;">
            قبول الدعوة · Accept invitation
          </a>
        </td></tr>

        <tr><td align="center" style="padding:0 28px 20px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:${BRAND.muted};">
            تنتهي صلاحية الدعوة خلال ${INVITE_TTL_DAYS} أيام · This invitation expires in ${INVITE_TTL_DAYS} days
          </p>
        </td></tr>

        <tr><td style="padding:0 28px;"><div style="height:1px;background:${BRAND.hairline};"></div></td></tr>

        <tr><td dir="ltr" align="left" style="padding:22px 28px 8px;color:${BRAND.ink};">
          <h2 style="margin:0 0 10px;font-size:18px;line-height:1.4;font-weight:700;">You've been invited to join ${escapeHtml(p.orgNameEn)}</h2>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:${BRAND.muted};">
            You'll join as
            <span style="display:inline-block;background:${BRAND.chipBg};color:${BRAND.ink};border-radius:999px;padding:2px 10px;font-weight:600;">${escapeHtml(p.roleEn)}</span>.
            Your account is yours alone — every clinical action is attributed to your name, which is exactly what makes the record trustworthy.
          </p>
          <p style="margin:0 0 6px;font-size:13px;line-height:1.7;color:${BRAND.muted};">
            If the button doesn't work, paste this link into your browser:<br />
            <a href="${escapeHtml(p.url)}" style="color:${BRAND.green};word-break:break-all;">${escapeHtml(p.url)}</a>
          </p>
        </td></tr>

        <tr><td style="padding:16px 28px 26px;">
          <p style="margin:0;font-size:12px;line-height:1.7;color:${BRAND.muted};">
            إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة بأمان.<br />
            If you weren't expecting this invitation, you can safely ignore this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `تمت دعوتك للانضمام إلى ${p.orgNameAr} بصفة ${p.roleAr}.`,
    `You've been invited to join ${p.orgNameEn} on Moracat as ${p.roleEn}.`,
    "",
    `اقبل الدعوة · Accept: ${p.url}`,
    "",
    `تنتهي الصلاحية خلال ${INVITE_TTL_DAYS} أيام · Expires in ${INVITE_TTL_DAYS} days.`,
    "إذا لم تكن تتوقع هذه الدعوة، تجاهل الرسالة · If you weren't expecting this, ignore this email.",
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
