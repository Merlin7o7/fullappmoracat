import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { VET_ROLE_LABELS } from "@moraqat/core";
import type { VetRole } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { IdsService } from "../ids/ids.service";
import { vetError } from "./guards/vet-staff.guard";
import { VetStaffService } from "./vet-staff.service";
import type { RequestMeta } from "./vet-auth.service";
import type {
  AccessLogQueryDto,
  ApplicationListQueryDto,
  ApproveApplicationDto,
  OrgListQueryDto,
  RejectApplicationDto,
  ReviewApplicationDto,
  SuspendOrgDto,
} from "./dto/vet-admin.dto";

const DEFAULT_LIMIT = 25;

/**
 * Moracat-side administration of the partner network — MRC-VET-001 §01.
 *
 * Every clinic is reviewed by a person. That is a product decision, not an
 * operational shortcut we intend to automate away: the verified badge in the
 * member-facing directory is only worth something because a human checked the
 * paperwork behind it. Every mutation here writes an AuditLog row.
 */
@Injectable()
export class VetAdminService {
  private readonly logger = new Logger("VetAdmin");

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly staff: VetStaffService
  ) {}

  // ── Applications ──────────────────────────────────────────────────────────

  async listApplications(query: ApplicationListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.PartnerApplicationWhereInput = {
      // Hits @@index([status, createdAt]).
      ...(query.status ? { status: query.status } : {}),
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.q
        ? {
            OR: [
              { clinicName: { contains: query.q, mode: "insensitive" as const } },
              { crNumber: { contains: query.q } },
              { contactName: { contains: query.q, mode: "insensitive" as const } },
              { contactEmail: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total, counts] = await Promise.all([
      this.prisma.partnerApplication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          clinicName: true,
          crNumber: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          licenceNo: true,
          status: true,
          orgId: true,
          reviewedAt: true,
          createdAt: true,
          city: { select: { id: true, nameEn: true, nameAr: true } },
        },
      }),
      this.prisma.partnerApplication.count({ where }),
      this.prisma.partnerApplication.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    return {
      items,
      // Queue counts drive the review inbox's tabs without a second round-trip.
      statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getApplication(id: string) {
    const application = await this.prisma.partnerApplication.findUnique({
      where: { id },
      select: {
        id: true,
        clinicName: true,
        crNumber: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        addressLine: true,
        licenceNo: true,
        notes: true,
        status: true,
        reviewedById: true,
        reviewedAt: true,
        reviewNote: true,
        orgId: true,
        createdAt: true,
        updatedAt: true,
        city: { select: { id: true, nameEn: true, nameAr: true } },
      },
    });
    if (!application) {
      throw new NotFoundException(
        vetError("VET_APPLICATION_NOT_FOUND", "Application not found.")
      );
    }

    // Does an account already exist for the contact? Tells the reviewer whether
    // approval will create a person or link one.
    const contactUser = await this.prisma.user.findUnique({
      where: { email: application.contactEmail },
      select: { id: true, firstName: true, lastName: true, createdAt: true },
    });

    return {
      ...application,
      contactUser,
      org: application.orgId
        ? await this.prisma.partnerOrg.findUnique({
            where: { id: application.orgId },
            select: { id: true, slug: true, nameEn: true, nameAr: true, status: true },
          })
        : null,
    };
  }

  /** Claim an application for review — makes the queue honest about who has it. */
  async markInReview(
    actorId: string,
    id: string,
    dto: ReviewApplicationDto,
    meta: RequestMeta
  ) {
    const application = await this.loadPendingApplication(id);

    const updated = await this.prisma.partnerApplication.update({
      where: { id: application.id },
      data: {
        status: "IN_REVIEW",
        reviewedById: actorId,
        reviewNote: dto.reviewNote ?? application.reviewNote,
      },
      select: { id: true, status: true },
    });
    await this.audit(actorId, "vet.application.review", "PartnerApplication", id, meta, {
      crNumber: application.crNumber,
    });
    return updated;
  }

  /**
   * Approve a clinic: create the org, its first branch, and the contact's OWNER
   * membership — then email them an invitation to claim it.
   *
   * The org lands in APPROVED, not LIVE. Approval says "you're in"; going live
   * is a separate, deliberate switch once the owner has actually set the clinic
   * up. Nothing appears in the member-facing directory until verification too,
   * so a member never sees a clinic that cannot receive them.
   */
  async approve(actorId: string, id: string, dto: ApproveApplicationDto, meta: RequestMeta) {
    const application = await this.loadPendingApplication(id);

    const nameEn = (dto.nameEn ?? application.clinicName).trim();
    const nameAr = dto.nameAr.trim();
    const slug = await this.uniqueSlug(dto.slug ?? nameEn);

    const crClash = await this.prisma.partnerOrg.findUnique({
      where: { crNumber: application.crNumber },
      select: { id: true },
    });
    if (crClash) {
      throw new ConflictException(
        vetError(
          "VET_ORG_CR_TAKEN",
          "A partner org already exists with this commercial registration."
        )
      );
    }

    // Mint outside the transaction: ID generation probes for uniqueness and has
    // no business holding a write lock open.
    const memberIdNumber = await this.ids.newMemberId();
    const contactEmail = application.contactEmail.toLowerCase().trim();
    const { firstName, lastName } = splitName(application.contactName);

    // A phone number is unique across users; if it already belongs to someone
    // else we simply don't set it rather than failing the whole approval.
    const phoneTaken = await this.prisma.user.findFirst({
      where: { phone: application.contactPhone },
      select: { id: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // Link the existing account, or create one. Either way the person signs in
      // with their ordinary Moracat credentials — no parallel clinic identity.
      let user = await tx.user.findUnique({
        where: { email: contactEmail },
        select: { id: true, email: true },
      });
      let userCreated = false;

      if (!user) {
        user = await tx.user.create({
          data: {
            email: contactEmail,
            memberIdNumber,
            firstName,
            lastName,
            ...(phoneTaken ? {} : { phone: application.contactPhone }),
            // PENDING: they set a password through the invitation, and the
            // account activates when they do.
            status: "PENDING",
          },
          select: { id: true, email: true },
        });
        userCreated = true;
      }

      const org = await tx.partnerOrg.create({
        data: {
          slug,
          nameEn,
          nameAr,
          crNumber: application.crNumber,
          status: "APPROVED",
          tier: dto.tier ?? "standard",
        },
        select: { id: true, slug: true, nameEn: true, nameAr: true, status: true },
      });

      const branch = await tx.branch.create({
        data: {
          orgId: org.id,
          nameEn: (dto.branchNameEn ?? nameEn).trim(),
          nameAr: (dto.branchNameAr ?? nameAr).trim(),
          cityId: application.cityId,
          addressLine: application.addressLine,
          phone: application.contactPhone,
          email: contactEmail,
          licenceNo: application.licenceNo,
          // Unverified clinics are never in the directory — the badge must mean
          // something, so publishing waits for a human check.
          directoryVisible: false,
        },
        select: { id: true, nameEn: true, nameAr: true },
      });

      const ownerStaff = await tx.partnerStaff.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: "OWNER",
          // INVITED until they accept — approval creates the seat, not the session.
          status: "INVITED",
          invitedById: actorId,
        },
        select: { id: true },
      });

      await tx.partnerApplication.update({
        where: { id: application.id },
        data: {
          status: "APPROVED",
          orgId: org.id,
          reviewedById: actorId,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote ?? application.reviewNote,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "vet.application.approve",
          entityType: "PartnerApplication",
          entityId: application.id,
          metadata: {
            orgId: org.id,
            slug: org.slug,
            branchId: branch.id,
            ownerStaffId: ownerStaff.id,
            ownerUserId: user.id,
            ownerUserCreated: userCreated,
            crNumber: application.crNumber,
          },
          ipAddress: meta.ipAddress,
        },
      });

      return { org, branch, ownerStaffId: ownerStaff.id, userId: user.id, userCreated };
    });

    // Outside the transaction: sending mail must never hold a write lock, and a
    // mail hiccup must never roll back an approval that really happened.
    let invited = true;
    try {
      await this.staff.createInvite({
        orgId: result.org.id,
        email: contactEmail,
        role: "OWNER",
        invitedByUserId: actorId,
      });
    } catch (err) {
      invited = false;
      this.logger.error(
        `Approved org ${result.org.id} but the owner invitation failed: ${(err as Error).message}`
      );
    }

    return {
      ...result,
      invited,
      /** Surfaced so an operator can resend by hand if the email failed. */
      ownerEmail: contactEmail,
    };
  }

  async reject(actorId: string, id: string, dto: RejectApplicationDto, meta: RequestMeta) {
    const application = await this.loadPendingApplication(id);

    const updated = await this.prisma.partnerApplication.update({
      where: { id: application.id },
      data: {
        status: "REJECTED",
        reviewedById: actorId,
        reviewedAt: new Date(),
        reviewNote: dto.reason.trim(),
      },
      select: { id: true, status: true, reviewNote: true },
    });
    await this.audit(actorId, "vet.application.reject", "PartnerApplication", id, meta, {
      crNumber: application.crNumber,
      reason: dto.reason,
    });
    return updated;
  }

  private async loadPendingApplication(id: string) {
    const application = await this.prisma.partnerApplication.findUnique({
      where: { id },
      select: {
        id: true,
        clinicName: true,
        crNumber: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        cityId: true,
        addressLine: true,
        licenceNo: true,
        reviewNote: true,
        status: true,
      },
    });
    if (!application) {
      throw new NotFoundException(
        vetError("VET_APPLICATION_NOT_FOUND", "Application not found.")
      );
    }
    if (application.status !== "SUBMITTED" && application.status !== "IN_REVIEW") {
      throw new BadRequestException(
        vetError(
          "VET_APPLICATION_NOT_PENDING",
          `This application is already ${application.status.toLowerCase()}.`,
          { status: application.status }
        )
      );
    }
    return application;
  }

  // ── Orgs ──────────────────────────────────────────────────────────────────

  async listOrgs(query: OrgListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const where: Prisma.PartnerOrgWhereInput = {
      // Hits @@index([status]).
      ...(query.status ? { status: query.status } : {}),
      ...(query.verified === "true" ? { verifiedAt: { not: null } } : {}),
      ...(query.verified === "false" ? { verifiedAt: null } : {}),
      ...(query.q
        ? {
            OR: [
              { nameEn: { contains: query.q, mode: "insensitive" as const } },
              { nameAr: { contains: query.q } },
              { slug: { contains: query.q, mode: "insensitive" as const } },
              { crNumber: { contains: query.q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.partnerOrg.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          nameEn: true,
          nameAr: true,
          crNumber: true,
          status: true,
          tier: true,
          verifiedAt: true,
          suspendedAt: true,
          createdAt: true,
          _count: { select: { branches: true, staff: true, visits: true } },
        },
      }),
      this.prisma.partnerOrg.count({ where }),
    ]);

    return {
      items: items.map((o) => ({
        ...o,
        verified: !!o.verifiedAt,
        counts: { branches: o._count.branches, staff: o._count.staff, visits: o._count.visits },
        _count: undefined,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrg(id: string) {
    const org = await this.prisma.partnerOrg.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameAr: true,
        crNumber: true,
        vatNumber: true,
        logoUrl: true,
        status: true,
        tier: true,
        verifiedAt: true,
        suspendedAt: true,
        suspendReason: true,
        createdAt: true,
        branches: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            isActive: true,
            directoryVisible: true,
            emergency24h: true,
            licenceNo: true,
            licenceExpiresAt: true,
            city: { select: { id: true, nameEn: true, nameAr: true } },
            documents: {
              select: { id: true, kind: true, fileUrl: true, expiresAt: true, verifiedAt: true },
            },
          },
        },
        staff: {
          where: { status: { not: "OFFBOARDED" } },
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!org) throw new NotFoundException(vetError("VET_ORG_NOT_FOUND", "Clinic not found."));

    return {
      ...org,
      verified: !!org.verifiedAt,
      staff: org.staff.map((s) => ({
        ...s,
        role: s.role as VetRole,
        roleLabel: VET_ROLE_LABELS[s.role as VetRole],
      })),
    };
  }

  /**
   * Mark an org verified — documents checked by a human. This is what unlocks
   * the directory badge, so it is deliberately its own audited action rather
   * than a checkbox bundled into approval.
   */
  async verifyOrg(actorId: string, id: string, meta: RequestMeta) {
    await this.assertOrg(id);
    const org = await this.prisma.partnerOrg.update({
      where: { id },
      data: { verifiedAt: new Date() },
      select: { id: true, verifiedAt: true, status: true },
    });
    await this.audit(actorId, "vet.org.verify", "PartnerOrg", id, meta, {});
    return { ...org, verified: true };
  }

  async unverifyOrg(actorId: string, id: string, meta: RequestMeta) {
    await this.assertOrg(id);
    const [org] = await this.prisma.$transaction([
      this.prisma.partnerOrg.update({
        where: { id },
        data: { verifiedAt: null },
        select: { id: true, verifiedAt: true, status: true },
      }),
      // An unverified clinic must leave the directory the same instant.
      this.prisma.branch.updateMany({ where: { orgId: id }, data: { directoryVisible: false } }),
    ]);
    await this.audit(actorId, "vet.org.unverify", "PartnerOrg", id, meta, {});
    return { ...org, verified: false };
  }

  /** Flip an approved clinic to LIVE — the moment members can actually be seen. */
  async goLive(actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.assertOrg(id);
    if (existing.status === "LIVE") return { id, status: "LIVE" };
    if (existing.status !== "APPROVED") {
      throw new BadRequestException(
        vetError(
          "VET_ORG_NOT_LIVE",
          "Only an approved clinic can go live.",
          { status: existing.status }
        )
      );
    }

    const org = await this.prisma.partnerOrg.update({
      where: { id },
      data: { status: "LIVE", suspendedAt: null, suspendReason: null },
      select: { id: true, status: true },
    });
    await this.audit(actorId, "vet.org.golive", "PartnerOrg", id, meta, {});
    return org;
  }

  async suspendOrg(actorId: string, id: string, dto: SuspendOrgDto, meta: RequestMeta) {
    await this.assertOrg(id);

    const [org] = await this.prisma.$transaction([
      this.prisma.partnerOrg.update({
        where: { id },
        data: {
          status: "SUSPENDED",
          suspendedAt: new Date(),
          suspendReason: dto.reason.trim(),
        },
        select: { id: true, status: true, suspendedAt: true, suspendReason: true },
      }),
      // A suspended clinic disappears from "find a clinic" immediately — a
      // member must never be sent to a door that will not open.
      this.prisma.branch.updateMany({ where: { orgId: id }, data: { directoryVisible: false } }),
      // Every warm terminal in the org goes cold.
      this.prisma.deviceSession.updateMany({
        where: {
          revokedAt: null,
          deviceLabel: { startsWith: "vet-counter:" },
          user: { partnerStaff: { some: { orgId: id } } },
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit(actorId, "vet.org.suspend", "PartnerOrg", id, meta, { reason: dto.reason });
    return org;
  }

  /**
   * Lift a suspension. Returns the org to APPROVED rather than LIVE: going live
   * again is a deliberate second act, so a clinic is never quietly reopened to
   * members before someone confirms it is ready.
   */
  async unsuspendOrg(actorId: string, id: string, meta: RequestMeta) {
    const existing = await this.assertOrg(id);
    if (existing.status !== "SUSPENDED") {
      throw new BadRequestException(
        vetError("VET_ORG_NOT_LIVE", "This clinic is not suspended.", { status: existing.status })
      );
    }

    const org = await this.prisma.partnerOrg.update({
      where: { id },
      data: { status: "APPROVED", suspendedAt: null, suspendReason: null },
      select: { id: true, status: true },
    });
    await this.audit(actorId, "vet.org.unsuspend", "PartnerOrg", id, meta, {});
    return org;
  }

  // ── Audit: who read whose record ──────────────────────────────────────────

  /**
   * The org's record-access ledger. The same rows the *owner* of a cat can see
   * about this clinic — privacy as a visible ledger, reviewable from both ends.
   */
  async orgAccessLogs(id: string, query: AccessLogQueryDto) {
    await this.assertOrg(id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const where: Prisma.RecordAccessLogWhereInput = {
      // Hits @@index([orgId, at]).
      orgId: id,
      ...(query.catId ? { catId: query.catId } : {}),
      ...(query.emergency === "true" ? { emergency: true } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.recordAccessLog.findMany({
        where,
        orderBy: { at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          catId: true,
          tier: true,
          surface: true,
          emergency: true,
          ipAddress: true,
          at: true,
          cat: { select: { id: true, name: true, catIdNumber: true } },
          staff: {
            select: {
              id: true,
              role: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      }),
      this.prisma.recordAccessLog.count({ where }),
    ]);

    return {
      items: items.map((row) => ({
        ...row,
        staff: row.staff
          ? {
              id: row.staff.id,
              role: row.staff.role as VetRole,
              name:
                [row.staff.user.firstName, row.staff.user.lastName].filter(Boolean).join(" ") ||
                row.staff.user.email,
            }
          : null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async assertOrg(id: string) {
    const org = await this.prisma.partnerOrg.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!org) throw new NotFoundException(vetError("VET_ORG_NOT_FOUND", "Clinic not found."));
    return org;
  }

  /** Slugify, then disambiguate — slugs are permanent public identifiers. */
  private async uniqueSlug(source: string): Promise<string> {
    const base =
      source
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60) || "clinic";

    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? base : `${base}-${n + 1}`;
      const taken = await this.prisma.partnerOrg.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    throw new ConflictException(
      vetError("VET_ORG_SLUG_TAKEN", "Could not derive a free slug — provide one explicitly.")
    );
  }

  private async audit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    meta: RequestMeta,
    metadata: Record<string, unknown>
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action,
        entityType,
        entityId,
        metadata: metadata as Prisma.InputJsonValue,
        ipAddress: meta.ipAddress,
      },
    });
  }
}

/** "Dr. Noura Al-Harbi" → { firstName: "Dr. Noura", lastName: "Al-Harbi" }. */
function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: null };
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: null };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] ?? null };
}
