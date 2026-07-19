import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { vetError } from "./guards/vet-staff.guard";
import type { VetActor } from "./decorators/vet-actor.decorator";
import { VetAuthService, type RequestMeta } from "./vet-auth.service";
import type {
  ApplyDto,
  CreateBranchDocumentDto,
  CreateBranchDto,
  DirectoryQueryDto,
  RegisterDeviceDto,
  UpdateBranchDto,
  UpdateOrgDto,
} from "./dto/vet-org.dto";

const DEFAULT_DIRECTORY_LIMIT = 24;

/**
 * Partner organisation, branches, documents and terminals — MRC-VET-001 §15/§16.
 *
 * Also owns the two surfaces that face outward: the public clinic application
 * and the member-facing directory. Both are deliberately in this file because
 * they are the same object graph seen from opposite ends — a clinic asking to
 * join, and a member deciding to walk in.
 */
@Injectable()
export class VetOrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vetAuth: VetAuthService
  ) {}

  // ── Public: apply to join ─────────────────────────────────────────────────

  /**
   * A clinic's application. Public and unauthenticated on purpose — asking to
   * join must not require an account first; the account is created at approval,
   * when there is something to sign in to.
   */
  async apply(dto: ApplyDto, meta: RequestMeta) {
    const crNumber = dto.crNumber.trim();
    const contactEmail = dto.contactEmail.toLowerCase().trim();

    const city = await this.prisma.city.findFirst({
      where: { id: dto.cityId, isActive: true },
      select: { id: true },
    });
    if (!city) {
      throw new BadRequestException(
        vetError("VET_CITY_INVALID", "Choose a city we currently serve.")
      );
    }

    // CR is unique on both tables: a live partner and a pending application can
    // never both claim the same registration.
    const [existingApplication, existingOrg] = await Promise.all([
      this.prisma.partnerApplication.findUnique({
        where: { crNumber },
        select: { id: true, status: true },
      }),
      this.prisma.partnerOrg.findUnique({ where: { crNumber }, select: { id: true } }),
    ]);

    if (existingOrg) {
      throw new ConflictException(
        vetError(
          "VET_APPLICATION_DUPLICATE",
          "A clinic with this commercial registration is already on Moracat. Ask its owner to invite you."
        )
      );
    }
    if (existingApplication) {
      // Re-applying after a rejection is allowed — people fix their paperwork.
      if (existingApplication.status !== "REJECTED" && existingApplication.status !== "WITHDRAWN") {
        throw new ConflictException(
          vetError(
            "VET_APPLICATION_DUPLICATE",
            "We already have an application for this commercial registration. We'll be in touch."
          )
        );
      }
      const reopened = await this.prisma.partnerApplication.update({
        where: { id: existingApplication.id },
        data: {
          clinicName: dto.clinicName.trim(),
          contactName: dto.contactName.trim(),
          contactEmail,
          contactPhone: dto.contactPhone.trim(),
          cityId: city.id,
          addressLine: dto.addressLine?.trim() ?? null,
          licenceNo: dto.licenceNo?.trim() ?? null,
          notes: dto.notes?.trim() ?? null,
          status: "SUBMITTED",
          reviewedById: null,
          reviewedAt: null,
          reviewNote: null,
        },
        select: { id: true, status: true, createdAt: true },
      });
      await this.logApplication(reopened.id, "vet.application.resubmit", meta, { crNumber });
      return this.applicationReceipt(reopened.id, reopened.status);
    }

    const application = await this.prisma.partnerApplication.create({
      data: {
        clinicName: dto.clinicName.trim(),
        crNumber,
        contactName: dto.contactName.trim(),
        contactEmail,
        contactPhone: dto.contactPhone.trim(),
        cityId: city.id,
        addressLine: dto.addressLine?.trim() ?? null,
        licenceNo: dto.licenceNo?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
      },
      select: { id: true, status: true },
    });
    await this.logApplication(application.id, "vet.application.submit", meta, { crNumber });

    return this.applicationReceipt(application.id, application.status);
  }

  /** What the applicant sees — a promise with a shape, in both languages. */
  private applicationReceipt(id: string, status: string) {
    return {
      id,
      status,
      message: {
        en: "Your application is in. We review every clinic by hand and reply within two working days.",
        ar: "وصل طلبك. نراجع كل عيادة يدويًا ونرد خلال يومي عمل.",
      },
    };
  }

  private async logApplication(
    entityId: string,
    action: string,
    meta: RequestMeta,
    metadata: Prisma.InputJsonValue
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        entityType: "PartnerApplication",
        entityId,
        metadata,
        ipAddress: meta.ipAddress,
      },
    });
  }

  // ── Public: member-facing directory ───────────────────────────────────────

  /**
   * "Find a clinic" for members. Shows only branches a clinic has chosen to
   * publish, inside an org Moracat has actually verified — the badge has to
   * mean something. Contains no staff and no PII: this is a shopfront.
   */
  async directory(query: DirectoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_DIRECTORY_LIMIT;

    const where: Prisma.BranchWhereInput = {
      // Hits @@index([directoryVisible, isActive]).
      directoryVisible: true,
      isActive: true,
      org: { status: "LIVE", verifiedAt: { not: null }, suspendedAt: null },
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.emergency === "true" ? { emergency24h: true } : {}),
      ...(query.q
        ? {
            OR: [
              { nameEn: { contains: query.q, mode: "insensitive" as const } },
              { nameAr: { contains: query.q } },
              { org: { nameEn: { contains: query.q, mode: "insensitive" as const } } },
              { org: { nameAr: { contains: query.q } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        // Emergency clinics first: at 3am that ordering is the whole feature.
        orderBy: [{ emergency24h: "desc" }, { nameAr: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
          addressLine: true,
          lat: true,
          lng: true,
          mapsUrl: true,
          phone: true,
          hours: true,
          specialties: true,
          services: true,
          photos: true,
          emergency24h: true,
          city: { select: { id: true, slug: true, nameEn: true, nameAr: true } },
          org: { select: { id: true, slug: true, nameEn: true, nameAr: true, logoUrl: true } },
        },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return {
      items: rows.map((b) => ({ ...b, verified: true })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Org profile ───────────────────────────────────────────────────────────

  async getOrg(actor: VetActor) {
    const org = await this.prisma.partnerOrg.findUnique({
      where: { id: actor.orgId },
      select: {
        id: true,
        slug: true,
        nameEn: true,
        nameAr: true,
        crNumber: true,
        vatNumber: true,
        logoUrl: true,
        status: true,
        verifiedAt: true,
        tier: true,
        suspendedAt: true,
        suspendReason: true,
        createdAt: true,
        _count: { select: { branches: true, staff: true } },
      },
    });
    if (!org) {
      throw new NotFoundException(vetError("VET_ORG_NOT_FOUND", "Clinic not found."));
    }
    return {
      ...org,
      verified: !!org.verifiedAt,
      counts: { branches: org._count.branches, staff: org._count.staff },
      _count: undefined,
    };
  }

  async updateOrg(actor: VetActor, dto: UpdateOrgDto, meta: RequestMeta) {
    if (dto.vatNumber) {
      const clash = await this.prisma.partnerOrg.findFirst({
        where: { vatNumber: dto.vatNumber, id: { not: actor.orgId } },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException(
          vetError("VET_VAT_TAKEN", "Another clinic is already registered with this VAT number.")
        );
      }
    }

    const org = await this.prisma.partnerOrg.update({
      where: { id: actor.orgId },
      data: {
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn.trim() } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.vatNumber !== undefined ? { vatNumber: dto.vatNumber } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      },
      select: { id: true, nameEn: true, nameAr: true, vatNumber: true, logoUrl: true },
    });

    await this.audit(actor, "vet.org.update", "PartnerOrg", org.id, meta, {
      changed: Object.keys(dto),
    });
    return org;
  }

  // ── Branches ──────────────────────────────────────────────────────────────

  async listBranches(actor: VetActor) {
    const branches = await this.prisma.branch.findMany({
      // Hits @@index([orgId]).
      where: { orgId: actor.orgId },
      orderBy: [{ isActive: "desc" }, { nameAr: "asc" }],
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        addressLine: true,
        lat: true,
        lng: true,
        mapsUrl: true,
        phone: true,
        email: true,
        hours: true,
        specialties: true,
        services: true,
        photos: true,
        emergency24h: true,
        directoryVisible: true,
        licenceNo: true,
        licenceExpiresAt: true,
        isActive: true,
        city: { select: { id: true, nameEn: true, nameAr: true } },
        _count: { select: { devices: true } },
      },
    });

    // A branch-scoped manager sees only the branches they run.
    const visible = actor.branchIds.length
      ? branches.filter((b) => actor.branchIds.includes(b.id))
      : branches;

    return {
      items: visible.map((b) => ({
        ...b,
        deviceCount: b._count.devices,
        _count: undefined,
        licenceExpiringSoon: isExpiringSoon(b.licenceExpiresAt),
      })),
    };
  }

  async getBranch(actor: VetActor, branchId: string) {
    const branch = await this.assertBranch(actor, branchId);
    return branch;
  }

  async createBranch(actor: VetActor, dto: CreateBranchDto, meta: RequestMeta) {
    // Branch-scoped managers run branches; they do not open new ones.
    if (actor.branchIds.length > 0) {
      throw new BadRequestException(
        vetError(
          "VET_FORBIDDEN",
          "Your access is limited to specific branches, so you cannot open a new one.",
          { capability: "branch.manage" }
        )
      );
    }
    await this.assertCity(dto.cityId);

    const branch = await this.prisma.branch.create({
      data: {
        orgId: actor.orgId,
        ...this.branchWriteData(dto),
        nameEn: dto.nameEn.trim(),
        nameAr: dto.nameAr.trim(),
        // Publishing is gated on verification, so a brand-new branch never
        // appears in the directory by accident.
        directoryVisible: dto.directoryVisible ?? false,
      },
      select: { id: true, nameEn: true, nameAr: true, isActive: true },
    });

    await this.audit(actor, "vet.branch.create", "Branch", branch.id, meta, {
      orgId: actor.orgId,
      nameEn: branch.nameEn,
    });
    return branch;
  }

  async updateBranch(actor: VetActor, branchId: string, dto: UpdateBranchDto, meta: RequestMeta) {
    await this.assertBranch(actor, branchId);
    await this.assertCity(dto.cityId);

    const branch = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...this.branchWriteData(dto),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn.trim() } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        directoryVisible: true,
        isActive: true,
        emergency24h: true,
      },
    });

    await this.audit(actor, "vet.branch.update", "Branch", branch.id, meta, {
      orgId: actor.orgId,
      changed: Object.keys(dto),
    });
    return branch;
  }

  /**
   * Close a branch. Deactivation, never deletion — visits and clinical entries
   * point at this row and medical history must stay reconstructable forever.
   */
  async deactivateBranch(actor: VetActor, branchId: string, meta: RequestMeta) {
    await this.assertBranch(actor, branchId);

    const [branch] = await this.prisma.$transaction([
      this.prisma.branch.update({
        where: { id: branchId },
        data: { isActive: false, directoryVisible: false },
        select: { id: true, isActive: true },
      }),
      // A closed branch's terminals must not stay unlockable.
      this.prisma.counterDevice.updateMany({
        where: { branchId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit(actor, "vet.branch.deactivate", "Branch", branchId, meta, {
      orgId: actor.orgId,
    });
    return branch;
  }

  private branchWriteData(dto: CreateBranchDto | UpdateBranchDto) {
    return {
      ...(dto.cityId !== undefined ? { cityId: dto.cityId } : {}),
      ...(dto.addressLine !== undefined ? { addressLine: dto.addressLine } : {}),
      ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
      ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
      ...(dto.mapsUrl !== undefined ? { mapsUrl: dto.mapsUrl } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.email !== undefined ? { email: dto.email.toLowerCase().trim() } : {}),
      ...(dto.hours !== undefined ? { hours: dto.hours as unknown as Prisma.InputJsonValue } : {}),
      ...(dto.specialties !== undefined ? { specialties: dto.specialties } : {}),
      ...(dto.services !== undefined ? { services: dto.services } : {}),
      ...(dto.photos !== undefined ? { photos: dto.photos } : {}),
      ...(dto.emergency24h !== undefined ? { emergency24h: dto.emergency24h } : {}),
      ...(dto.directoryVisible !== undefined ? { directoryVisible: dto.directoryVisible } : {}),
      ...(dto.licenceNo !== undefined ? { licenceNo: dto.licenceNo } : {}),
      ...(dto.licenceExpiresAt !== undefined
        ? { licenceExpiresAt: new Date(dto.licenceExpiresAt) }
        : {}),
    };
  }

  // ── Branch documents ──────────────────────────────────────────────────────

  async listBranchDocuments(actor: VetActor, branchId: string) {
    await this.assertBranch(actor, branchId);
    const items = await this.prisma.branchDocument.findMany({
      // Hits @@index([branchId]).
      where: { branchId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        fileUrl: true,
        expiresAt: true,
        verifiedAt: true,
        createdAt: true,
      },
    });
    return {
      items: items.map((d) => ({
        ...d,
        verified: !!d.verifiedAt,
        expiringSoon: isExpiringSoon(d.expiresAt),
        expired: !!d.expiresAt && d.expiresAt.getTime() < Date.now(),
      })),
    };
  }

  async addBranchDocument(
    actor: VetActor,
    branchId: string,
    dto: CreateBranchDocumentDto,
    meta: RequestMeta
  ) {
    await this.assertBranch(actor, branchId);
    const doc = await this.prisma.branchDocument.create({
      data: {
        branchId,
        kind: dto.kind,
        fileUrl: dto.fileUrl,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      select: { id: true, kind: true, fileUrl: true, expiresAt: true, createdAt: true },
    });

    await this.audit(actor, "vet.branch.document.add", "BranchDocument", doc.id, meta, {
      orgId: actor.orgId,
      branchId,
      kind: dto.kind,
    });
    return doc;
  }

  async removeBranchDocument(
    actor: VetActor,
    branchId: string,
    documentId: string,
    meta: RequestMeta
  ) {
    await this.assertBranch(actor, branchId);
    const doc = await this.prisma.branchDocument.findFirst({
      where: { id: documentId, branchId },
      select: { id: true, kind: true },
    });
    if (!doc) {
      throw new NotFoundException(vetError("VET_DOCUMENT_NOT_FOUND", "Document not found."));
    }

    await this.prisma.branchDocument.delete({ where: { id: documentId } });
    await this.audit(actor, "vet.branch.document.remove", "BranchDocument", documentId, meta, {
      orgId: actor.orgId,
      branchId,
      kind: doc.kind,
    });
    return { removed: true };
  }

  // ── Counter devices ───────────────────────────────────────────────────────

  async listDevices(actor: VetActor) {
    const devices = await this.prisma.counterDevice.findMany({
      where: {
        branch: {
          orgId: actor.orgId,
          ...(actor.branchIds.length ? { id: { in: actor.branchIds } } : {}),
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        lastSeenAt: true,
        revokedAt: true,
        createdAt: true,
        branch: { select: { id: true, nameEn: true, nameAr: true } },
        registeredBy: { select: { firstName: true, lastName: true } },
      },
    });
    return {
      items: devices.map((d) => ({
        ...d,
        active: !d.revokedAt,
        registeredBy:
          [d.registeredBy?.firstName, d.registeredBy?.lastName].filter(Boolean).join(" ") || null,
      })),
    };
  }

  /**
   * Register a shared terminal. Counter Mode only ever works on a device a
   * manager deliberately vouched for — that is what makes a 4-digit PIN an
   * acceptable identity switch rather than a shared password (§02).
   */
  async registerDevice(
    actor: VetActor,
    branchId: string,
    dto: RegisterDeviceDto,
    meta: RequestMeta
  ) {
    await this.assertBranch(actor, branchId);
    const device = await this.prisma.counterDevice.create({
      data: { branchId, name: dto.name.trim(), registeredById: actor.userId },
      select: { id: true, name: true, branchId: true, createdAt: true },
    });

    await this.audit(actor, "vet.device.register", "CounterDevice", device.id, meta, {
      orgId: actor.orgId,
      branchId,
      name: device.name,
    });
    return device;
  }

  /** Revoke a terminal and kill every counter session it is currently holding. */
  async revokeDevice(actor: VetActor, deviceId: string, meta: RequestMeta) {
    const device = await this.prisma.counterDevice.findUnique({
      where: { id: deviceId },
      select: { id: true, name: true, branchId: true, branch: { select: { orgId: true } } },
    });
    if (!device || device.branch.orgId !== actor.orgId) {
      throw new NotFoundException(
        vetError("VET_DEVICE_NOT_REGISTERED", "That terminal is not registered to your clinic.")
      );
    }
    if (actor.branchIds.length && !actor.branchIds.includes(device.branchId)) {
      throw new NotFoundException(
        vetError("VET_DEVICE_NOT_REGISTERED", "That terminal is not in your branch scope.")
      );
    }

    await this.prisma.counterDevice.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });
    const killed = await this.vetAuth.revokeCounterSessionsForDevice(deviceId);

    await this.audit(actor, "vet.device.revoke", "CounterDevice", deviceId, meta, {
      orgId: actor.orgId,
      branchId: device.branchId,
      sessionsRevoked: killed,
    });
    return { revoked: true, sessionsRevoked: killed };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Load a branch, proving it belongs to the actor's org and branch scope. */
  private async assertBranch(actor: VetActor, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, orgId: actor.orgId },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        addressLine: true,
        lat: true,
        lng: true,
        mapsUrl: true,
        phone: true,
        email: true,
        hours: true,
        specialties: true,
        services: true,
        photos: true,
        emergency24h: true,
        directoryVisible: true,
        licenceNo: true,
        licenceExpiresAt: true,
        isActive: true,
        city: { select: { id: true, nameEn: true, nameAr: true } },
      },
    });
    if (!branch) {
      throw new NotFoundException(vetError("VET_BRANCH_NOT_FOUND", "Branch not found."));
    }
    if (actor.branchIds.length && !actor.branchIds.includes(branchId)) {
      throw new NotFoundException(
        vetError("VET_BRANCH_NOT_FOUND", "That branch is outside your access.")
      );
    }
    return branch;
  }

  private async assertCity(cityId?: string) {
    if (!cityId) return;
    const city = await this.prisma.city.findFirst({
      where: { id: cityId, isActive: true },
      select: { id: true },
    });
    if (!city) {
      throw new BadRequestException(
        vetError("VET_CITY_INVALID", "Choose a city we currently serve.")
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
          staffId: actor.staffId,
          role: actor.role,
          counterMode: actor.counterMode,
        } as Prisma.InputJsonValue,
        ipAddress: meta.ipAddress,
      },
    });
  }
}

/** Licences and documents inside 60 days of expiry deserve a nudge, not a surprise. */
function isExpiringSoon(date: Date | null): boolean {
  if (!date) return false;
  const days = (date.getTime() - Date.now()) / 86_400_000;
  return days > 0 && days <= 60;
}
