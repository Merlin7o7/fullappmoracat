import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@moraqat/db";
import {
  canonicalTermsText,
  CLINIC_DOCUMENT_LABELS,
  CLINIC_DOCUMENT_MAX_BYTES,
  CLINIC_STATUS_LABELS,
  findSaudiCity,
  normalizeSaudiMobile,
  REGISTRATION_EDITABLE_STATUSES,
  REGISTRATION_INVITE_TTL_DAYS,
  REGISTRATION_REVIEWABLE_STATUSES,
  registrationGaps,
  VET_PARTNER_AGREEMENT,
  VET_PARTNER_TERMS_VERSION,
  VET_PDPL_ADDENDUM,
  VET_ROLE_LABELS,
  VET_STAFF_CONFIDENTIALITY_VERSION,
} from "@moraqat/core";
import type { ClinicDocumentKind, ClinicOrgStatus, RegistrationStep, VetRole } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { StorageService } from "../storage/storage.service";
import { AuthService } from "../auth/auth.service";
import { vetError } from "./guards/vet-staff.guard";
import { hashToken, type RequestMeta } from "./vet-auth.service";
import { VetStaffService } from "./vet-staff.service";
import { buildVetNoticeEmail } from "./vet-registration.emails";
import type {
  AdminOrgListQueryDto,
  InviteClinicDto,
  RegistrationAccountDto,
  RegistrationBranchesDto,
  RegistrationClinicDto,
  RegistrationDocumentDto,
  RegistrationSubmitDto,
  RegistrationTeamDto,
  RegistrationTeamMember,
  RejectRegistrationDto,
  RequestChangesDto,
  ReviewNoteDto,
} from "./dto/vet-registration.dto";

const DEFAULT_LIMIT = 25;
/** Statuses that belong to the registration pipeline (before approval). */
const PIPELINE_STATUSES: ClinicOrgStatus[] = ["INVITED", "REGISTERING", "SUBMITTED", "CHANGES_REQUESTED", "IN_REVIEW"];

export interface UploadedDocumentFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

type DocScope = "org" | "branch";

/**
 * Clinic registration — MRC-VET-002 phases 1–3 and 5.
 *
 * One service owns the whole pipeline so the state machine lives in one file:
 *
 *   INVITED → REGISTERING → SUBMITTED ⇄ CHANGES_REQUESTED → APPROVED → LIVE
 *                                    ↘ REJECTED
 *
 * Moracat invites (admin only), the owner claims the link and fills the wizard,
 * submission accepts the versioned terms and sends staff invitations at once,
 * a human reviews every document, and going live is gated on one successful
 * test scan. Every transition is audited and emailed in both languages.
 */
@Injectable()
export class VetRegistrationService {
  private readonly logger = new Logger("VetRegistration");

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly storage: StorageService,
    private readonly accounts: AuthService,
    private readonly staff: VetStaffService
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  //  Admin — invite
  // ══════════════════════════════════════════════════════════════════════════

  async inviteClinic(actorId: string, dto: InviteClinicDto, meta: RequestMeta) {
    const email = dto.email.toLowerCase().trim();
    const phone = normalizeSaudiMobile(dto.phone);
    if (!phone) {
      throw new BadRequestException(
        vetError("VET_REG_PHONE_INVALID", "Enter a Saudi mobile number, e.g. 05XXXXXXXX.")
      );
    }

    // One live registration per owner address — a second invite would split the
    // clinic across two half-filled records.
    const open = await this.prisma.partnerOrg.findFirst({
      where: { contactEmail: email, status: { in: PIPELINE_STATUSES } },
      select: { id: true },
    });
    if (open) {
      throw new ConflictException(
        vetError("VET_REG_ALREADY_INVITED", "This email already has a clinic registration in progress.", {
          orgId: open.id,
        })
      );
    }

    const nameEn = dto.nameEn?.trim() || dto.nameAr.trim();
    const slug = await this.uniqueSlug(dto.nameEn ?? "");

    const org = await this.prisma.partnerOrg.create({
      data: {
        slug,
        nameAr: dto.nameAr.trim(),
        nameEn,
        status: "INVITED",
        tier: dto.tier ?? "standard",
        contactName: dto.contactName.trim(),
        contactEmail: email,
        contactPhone: phone,
        invitedById: actorId,
        inviteNote: dto.note ?? null,
      },
      select: { id: true, slug: true, nameAr: true, nameEn: true, status: true },
    });

    const invite = await this.issueRegistrationInvite(org.id, email, actorId);
    await this.audit(actorId, "vet.registration.invite", org.id, meta, { email, tier: dto.tier ?? "standard" });

    return { org, invite };
  }

  async resendRegistrationInvite(actorId: string, orgId: string, meta: RequestMeta) {
    const org = await this.loadOrg(orgId);
    if (!["INVITED", "REGISTERING", "CHANGES_REQUESTED"].includes(org.status)) {
      throw new BadRequestException(
        vetError("VET_REG_WRONG_STATUS", "Only a clinic that hasn't submitted yet can be re-invited.", {
          status: org.status,
        })
      );
    }
    if (!org.contactEmail) {
      throw new BadRequestException(vetError("VET_REG_WRONG_STATUS", "This clinic has no owner email on file."));
    }
    const invite = await this.issueRegistrationInvite(org.id, org.contactEmail, actorId);
    await this.audit(actorId, "vet.registration.invite.resend", org.id, meta, { email: org.contactEmail });
    return { invite };
  }

  /** Withdraw an invitation that was never claimed — the clinic record goes with it. */
  async revokeRegistrationInvite(actorId: string, orgId: string, meta: RequestMeta) {
    const org = await this.loadOrg(orgId);
    if (org.status !== "INVITED") {
      throw new BadRequestException(
        vetError(
          "VET_REG_WRONG_STATUS",
          "The owner has already started registering — reject the registration instead.",
          { status: org.status }
        )
      );
    }
    await this.prisma.$transaction([
      this.prisma.clinicRegistrationInvite.updateMany({
        where: { orgId, revokedAt: null, claimedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.partnerOrg.update({
        where: { id: orgId },
        data: { status: "REJECTED", rejectedReason: "سحبت مرقط الدعوة. · Invitation withdrawn by Moracat." },
      }),
    ]);
    await this.audit(actorId, "vet.registration.invite.revoke", orgId, meta, {});
    return { revoked: true };
  }

  private async issueRegistrationInvite(orgId: string, email: string, actorId: string | null) {
    // Supersede any live link: only the newest email ever works.
    await this.prisma.clinicRegistrationInvite.updateMany({
      where: { orgId, claimedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + REGISTRATION_INVITE_TTL_DAYS * 86_400_000);
    const row = await this.prisma.clinicRegistrationInvite.create({
      data: { orgId, email, tokenHash: hashToken(token), invitedById: actorId, expiresAt },
      select: { id: true, expiresAt: true },
    });

    const org = await this.prisma.partnerOrg.findUnique({
      where: { id: orgId },
      select: { nameAr: true, nameEn: true, contactName: true },
    });
    const url = `${siteUrl()}/vet/register?token=${encodeURIComponent(token)}`;
    await this.sendMail(email, {
      subjectAr: `دعوة لتسجيل ${org?.nameAr ?? "عيادتك"} في شبكة مرقط`,
      subjectEn: `Register ${org?.nameEn ?? "your clinic"} with the Moracat network`,
      headingAr: `${org?.contactName ? `أهلاً ${org.contactName}، ` : ""}ندعوك لتسجيل ${org?.nameAr ?? "عيادتك"}`,
      headingEn: `${org?.contactName ? `Hello ${org.contactName}, ` : ""}you're invited to register ${org?.nameEn ?? "your clinic"}`,
      bodyAr: [
        "شبكة عيادات مرقط بالدعوة فقط — نختار شركاءنا بعناية لأن الأعضاء يثقون بمن نرشّحه لهم.",
        "التسجيل يأخذ نحو ١٥ دقيقة ويُحفظ تلقائياً. جهّز: شهادة السجل التجاري، ترخيص وزارة البيئة والمياه والزراعة لكل فرع، وأسماء الأطباء وأرقام تراخيصهم.",
      ],
      bodyEn: [
        "The Moracat clinic network is invitation-only — we choose partners carefully because members trust who we recommend.",
        "Registration takes about 15 minutes and saves as you go. Have ready: the commercial registration certificate, a MEWA veterinary licence for each branch, and your doctors' names and licence numbers.",
      ],
      cta: { labelAr: "ابدأ التسجيل", labelEn: "Start registration", url },
      footnoteAr: `ينتهي الرابط خلال ${REGISTRATION_INVITE_TTL_DAYS} يوماً. إذا لم تكن تتوقع هذه الرسالة فتجاهلها.`,
      footnoteEn: `This link expires in ${REGISTRATION_INVITE_TTL_DAYS} days. If you weren't expecting it, ignore this email.`,
    });

    return {
      id: row.id,
      email,
      expiresAt: row.expiresAt,
      // Dev/test only — the e2e suite follows the emailed link with it.
      ...(process.env.NODE_ENV !== "production" ? { devToken: token } : {}),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Public — the invitation link
  // ══════════════════════════════════════════════════════════════════════════

  async previewInvite(token: string) {
    const invite = await this.findInvite(token);
    const account = await this.prisma.user.findUnique({
      where: { email: invite.email },
      select: { passwordHash: true, status: true },
    });
    return {
      orgId: invite.orgId,
      orgName: { ar: invite.org.nameAr, en: invite.org.nameEn },
      status: invite.org.status,
      email: invite.email,
      contactName: invite.org.contactName,
      contactPhone: invite.org.contactPhone,
      expiresAt: invite.expiresAt,
      claimed: !!invite.claimedAt,
      accountExists: !!account && (!!account.passwordHash || account.status !== "PENDING"),
    };
  }

  /** No account yet: create it (email verified by the link) and claim the clinic. */
  async createOwnerAccount(dto: RegistrationAccountDto, meta: RequestMeta) {
    const invite = await this.findInvite(dto.token, { requireUnclaimed: true });
    const phone = normalizeSaudiMobile(dto.phone);
    if (!phone) {
      throw new BadRequestException(vetError("VET_REG_PHONE_INVALID", "Enter a Saudi mobile number, e.g. 05XXXXXXXX."));
    }
    const session = await this.accounts.createInvitedAccount(
      { email: invite.email, password: dto.password, firstName: dto.firstName, lastName: dto.lastName ?? null, phone },
      meta
    );
    const claimed = await this.claimFor(session.user.id, invite, meta);
    return { ...session, registration: claimed };
  }

  /** Already has an account and is signed in with the invited address: claim. */
  async claim(userId: string, userEmail: string, token: string, meta: RequestMeta) {
    const invite = await this.findInvite(token, { requireUnclaimed: false });
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        vetError("VET_INVITE_EMAIL_MISMATCH", "This invitation was sent to a different email address.", {
          invitedEmail: maskEmail(invite.email),
        })
      );
    }
    if (invite.claimedAt) {
      // Idempotent for the person who claimed it; closed to anyone else.
      if (invite.claimedById !== userId) {
        throw new BadRequestException(vetError("VET_INVITE_USED", "This invitation has already been used."));
      }
      return { orgId: invite.orgId, status: invite.org.status };
    }
    return this.claimFor(userId, invite, meta);
  }

  private async claimFor(userId: string, invite: Awaited<ReturnType<VetRegistrationService["findInvite"]>>, meta: RequestMeta) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.clinicRegistrationInvite.update({
        where: { id: invite.id },
        data: { claimedAt: now, claimedById: userId },
      });
      await tx.partnerStaff.upsert({
        where: { orgId_userId: { orgId: invite.orgId, userId } },
        update: { role: "OWNER", status: "ACTIVE", joinedAt: now, offboardedAt: null },
        create: { orgId: invite.orgId, userId, role: "OWNER", status: "ACTIVE", joinedAt: now, invitedById: invite.invitedById },
      });
      if (invite.org.status === "INVITED") {
        await tx.partnerOrg.update({ where: { id: invite.orgId }, data: { status: "REGISTERING" } });
      }
    });
    await this.audit(userId, "vet.registration.claim", invite.orgId, meta, { inviteId: invite.id });
    return { orgId: invite.orgId, status: invite.org.status === "INVITED" ? "REGISTERING" : invite.org.status };
  }

  private async findInvite(token: string, opts: { requireUnclaimed?: boolean } = {}) {
    const invite = await this.prisma.clinicRegistrationInvite.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        orgId: true,
        email: true,
        expiresAt: true,
        claimedAt: true,
        claimedById: true,
        revokedAt: true,
        invitedById: true,
        org: { select: { nameAr: true, nameEn: true, status: true, contactName: true, contactPhone: true } },
      },
    });
    if (!invite || invite.revokedAt || invite.org.status === "REJECTED") {
      throw new NotFoundException(vetError("VET_INVITE_INVALID", "This invitation is no longer valid."));
    }
    if (opts.requireUnclaimed && invite.claimedAt) {
      throw new BadRequestException(
        vetError("VET_INVITE_USED", "This invitation has already been used — sign in to continue.")
      );
    }
    // A claimed link keeps working for its owner; expiry only guards the claim.
    if (!invite.claimedAt && invite.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        vetError("VET_INVITE_EXPIRED", "This invitation has expired — ask Moracat for a new one.")
      );
    }
    return invite;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Owner — the wizard
  // ══════════════════════════════════════════════════════════════════════════

  /** Registrations this person owns that aren't live yet — powers the portal redirect. */
  async listMine(userId: string) {
    const rows = await this.prisma.partnerStaff.findMany({
      where: {
        userId,
        role: "OWNER",
        status: "ACTIVE",
        org: { status: { in: [...PIPELINE_STATUSES, "APPROVED", "REJECTED"] } },
      },
      select: { org: { select: { id: true, nameAr: true, nameEn: true, status: true, updatedAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    return {
      items: rows.map((r) => ({
        ...r.org,
        statusLabel: CLINIC_STATUS_LABELS[r.org.status as ClinicOrgStatus],
      })),
    };
  }

  async getState(userId: string, orgId: string) {
    await this.assertOwner(userId, orgId);
    return this.buildState(orgId, "owner");
  }

  async updateClinic(userId: string, orgId: string, dto: RegistrationClinicDto, meta: RequestMeta) {
    await this.assertEditable(userId, orgId, "clinic");
    const clash = await this.prisma.partnerOrg.findFirst({
      where: { crNumber: dto.crNumber, id: { not: orgId } },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(
        vetError(
          "VET_ORG_CR_TAKEN",
          "A clinic with this commercial registration is already on Moracat — ask its owner to invite you."
        )
      );
    }
    await this.prisma.partnerOrg.update({
      where: { id: orgId },
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        legalNameAr: dto.legalNameAr,
        legalNameEn: dto.legalNameEn ?? null,
        crNumber: dto.crNumber,
        unifiedNumber: dto.unifiedNumber,
        crExpiresAt: new Date(dto.crExpiresAt),
        vatNumber: dto.vatNumber ?? null,
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      },
    });
    await this.audit(userId, "vet.registration.clinic.update", orgId, meta, { crNumber: dto.crNumber });
    return this.buildState(orgId, "owner");
  }

  /**
   * Replace the branch set. Existing ids are updated, new rows created, and
   * branches no longer listed are removed — along with their documents, which
   * belonged to a branch that no longer exists. Branches never carry history
   * before approval, so deletion is safe here and only here.
   */
  async updateBranches(userId: string, orgId: string, dto: RegistrationBranchesDto, meta: RequestMeta) {
    await this.assertEditable(userId, orgId, "branches");
    const existing = await this.prisma.branch.findMany({
      where: { orgId },
      select: { id: true, documents: { select: { fileUrl: true } } },
    });
    const existingIds = new Set(existing.map((b) => b.id));
    for (const b of dto.branches) {
      if (b.id && !existingIds.has(b.id)) {
        throw new BadRequestException(vetError("VET_BRANCH_NOT_FOUND", "One of those branches isn't part of this clinic."));
      }
      if (!normalizeSaudiMobile(b.phone) && !/^\+?\d{8,15}$/.test(b.phone.replace(/[\s-]/g, ""))) {
        throw new BadRequestException(vetError("VET_REG_PHONE_INVALID", "Enter a valid phone number for each branch."));
      }
    }

    const cities = await this.prisma.city.findMany({ select: { id: true, slug: true } });
    const cityIdFor = (code: string) => cities.find((c) => c.slug === code)?.id ?? null;
    const keep = new Set(dto.branches.map((b) => b.id).filter(Boolean) as string[]);
    const removed = existing.filter((b) => !keep.has(b.id));

    await this.prisma.$transaction(async (tx) => {
      if (removed.length) {
        await tx.branch.deleteMany({ where: { id: { in: removed.map((b) => b.id) }, orgId } });
      }
      for (const b of dto.branches) {
        const phone = normalizeSaudiMobile(b.phone) ?? b.phone.replace(/[\s-]/g, "");
        const data = {
          nameAr: b.nameAr,
          nameEn: b.nameEn?.trim() || b.nameAr,
          cityCode: b.cityCode,
          cityId: cityIdFor(b.cityCode),
          district: b.district,
          addressLine: b.addressLine,
          nationalAddressCode: b.nationalAddressCode ?? null,
          lat: b.lat,
          lng: b.lng,
          mapsUrl: b.mapsUrl ?? `https://www.google.com/maps?q=${b.lat},${b.lng}`,
          phone,
          email: b.email?.toLowerCase() ?? null,
          hours: (b.hours ?? []) as unknown as Prisma.InputJsonValue,
          emergency24h: b.emergency24h ?? false,
          services: b.services ?? [],
          licenceNo: b.licenceNo,
          licenceExpiresAt: new Date(b.licenceExpiresAt),
          directoryVisible: false,
        };
        if (b.id) await tx.branch.update({ where: { id: b.id }, data });
        else await tx.branch.create({ data: { ...data, orgId } });
      }
    });

    // Storage cleanup after the commit — a failed delete must never undo it.
    for (const b of removed) {
      for (const d of b.documents) await this.storage.removePrivate(d.fileUrl);
    }
    await this.audit(userId, "vet.registration.branches.update", orgId, meta, {
      count: dto.branches.length,
      removed: removed.length,
    });
    return this.buildState(orgId, "owner");
  }

  async uploadDocument(
    userId: string,
    orgId: string,
    dto: RegistrationDocumentDto,
    file: UploadedDocumentFile | undefined,
    meta: RequestMeta
  ) {
    await this.assertEditable(userId, orgId, "documents");
    if (!file?.buffer?.length) {
      throw new BadRequestException(vetError("VET_DOC_MISSING", "Choose a file to upload."));
    }
    if (file.size > CLINIC_DOCUMENT_MAX_BYTES) {
      throw new PayloadTooLargeException(vetError("VET_DOC_TOO_LARGE", "Documents must be 10 MB or smaller."));
    }
    const sniffed = this.storage.sniffDocument(file.buffer);
    if (!sniffed) {
      throw new BadRequestException(vetError("VET_DOC_TYPE", "Upload a PDF, JPG or PNG."));
    }

    const branchLevel = dto.kind === "MEWA_LICENCE";
    if (branchLevel) {
      if (!dto.branchId) {
        throw new BadRequestException(vetError("VET_BRANCH_NOT_FOUND", "Choose which branch this licence belongs to."));
      }
      const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, orgId }, select: { id: true } });
      if (!branch) {
        throw new BadRequestException(vetError("VET_BRANCH_NOT_FOUND", "That branch isn't part of this clinic."));
      }
    }

    const key = this.storage.buildPrivateKey(`vet/${orgId}`, sniffed.ext);
    await this.storage.putPrivate(key, file.buffer, sniffed.mime);
    const fileName = safeFileName(file.originalname, sniffed.ext);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    // One current document per kind (per branch for licences): replacing a file
    // supersedes the old one rather than piling up candidates for the reviewer.
    let replacedKeys: string[] = [];
    if (branchLevel) {
      const old = await this.prisma.branchDocument.findMany({
        where: { branchId: dto.branchId!, kind: dto.kind },
        select: { id: true, fileUrl: true },
      });
      replacedKeys = old.map((o) => o.fileUrl);
      await this.prisma.$transaction([
        this.prisma.branchDocument.deleteMany({ where: { id: { in: old.map((o) => o.id) } } }),
        this.prisma.branchDocument.create({
          data: {
            branchId: dto.branchId!,
            kind: dto.kind,
            fileUrl: key,
            fileName,
            mimeType: sniffed.mime,
            sizeBytes: file.size,
            number: dto.number ?? null,
            expiresAt,
          },
        }),
      ]);
    } else if (dto.kind === "OTHER") {
      await this.prisma.orgDocument.create({
        data: { orgId, kind: dto.kind, fileKey: key, fileName, mimeType: sniffed.mime, sizeBytes: file.size, number: dto.number ?? null, expiresAt },
      });
    } else {
      const old = await this.prisma.orgDocument.findMany({ where: { orgId, kind: dto.kind }, select: { id: true, fileKey: true } });
      replacedKeys = old.map((o) => o.fileKey);
      await this.prisma.$transaction([
        this.prisma.orgDocument.deleteMany({ where: { id: { in: old.map((o) => o.id) } } }),
        this.prisma.orgDocument.create({
          data: { orgId, kind: dto.kind, fileKey: key, fileName, mimeType: sniffed.mime, sizeBytes: file.size, number: dto.number ?? null, expiresAt },
        }),
      ]);
    }
    for (const k of replacedKeys) await this.storage.removePrivate(k);

    await this.audit(userId, "vet.registration.document.upload", orgId, meta, {
      kind: dto.kind,
      branchId: dto.branchId ?? null,
      sizeBytes: file.size,
    });
    return this.buildState(orgId, "owner");
  }

  async deleteDocument(userId: string, orgId: string, documentId: string, meta: RequestMeta) {
    await this.assertEditable(userId, orgId, "documents");
    const doc = await this.findDocument(orgId, documentId);
    if (doc.scope === "org") await this.prisma.orgDocument.delete({ where: { id: doc.id } });
    else await this.prisma.branchDocument.delete({ where: { id: doc.id } });
    await this.storage.removePrivate(doc.key);
    await this.audit(userId, "vet.registration.document.delete", orgId, meta, { kind: doc.kind });
    return this.buildState(orgId, "owner");
  }

  /** The owner reading back their own upload. */
  async ownerDocumentFile(userId: string, orgId: string, documentId: string) {
    await this.assertOwner(userId, orgId);
    return this.readDocument(orgId, documentId);
  }

  async updateTeam(userId: string, orgId: string, dto: RegistrationTeamDto, meta: RequestMeta) {
    await this.assertEditable(userId, orgId, "team");
    const owner = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const branchIds = new Set(
      (await this.prisma.branch.findMany({ where: { orgId }, select: { id: true } })).map((b) => b.id)
    );

    const seen = new Set<string>();
    const members: RegistrationTeamMember[] = dto.members.map((m, i) => {
      const email = m.email.toLowerCase();
      if (seen.has(email)) {
        throw new BadRequestException(
          vetError("VET_REG_TEAM_DUPLICATE", `Team member ${i + 1} repeats an email address.`, { index: i })
        );
      }
      seen.add(email);
      if (owner && email === owner.email.toLowerCase()) {
        throw new BadRequestException(
          vetError("VET_REG_TEAM_OWNER", "You're already on the team as the owner — no need to add yourself.", { index: i })
        );
      }
      const phone = normalizeSaudiMobile(m.phone);
      if (!phone) {
        throw new BadRequestException(
          vetError("VET_REG_PHONE_INVALID", `Team member ${i + 1}: enter a Saudi mobile number.`, { index: i })
        );
      }
      return {
        fullName: m.fullName,
        email,
        phone,
        role: m.role,
        title: m.title ?? null,
        licenceNo: m.licenceNo ?? null,
        licenceExpiresAt: m.licenceExpiresAt ?? null,
        branchIds: (m.branchIds ?? []).filter((id) => branchIds.has(id)),
      };
    });

    // A solo practice: the owner's own seat carries the practitioner licence.
    // Practising owners hold the OWNER role, which already includes every
    // clinical capability, so no second membership is needed.
    const practises = !!dto.ownerPractisesAsVet;
    // "Practises" is stored AS the licence on the owner seat, so the two can't
    // be separated — refuse the half-state instead of silently dropping it.
    if (practises && !dto.ownerLicenceNo) {
      throw new BadRequestException(
        vetError("VET_REG_OWNER_LICENCE", "Enter your practitioner licence number to practise at the clinic.")
      );
    }
    await this.prisma.$transaction([
      this.prisma.partnerOrg.update({
        where: { id: orgId },
        data: { registrationTeam: members as unknown as Prisma.InputJsonValue },
      }),
      this.prisma.partnerStaff.updateMany({
        where: { orgId, userId, role: "OWNER" },
        data: practises
          ? {
              licenceNo: dto.ownerLicenceNo ?? null,
              licenceExpiresAt: dto.ownerLicenceExpiresAt ? new Date(dto.ownerLicenceExpiresAt) : null,
              title: dto.ownerTitle ?? null,
            }
          : { licenceNo: null, licenceExpiresAt: null },
      }),
    ]);
    await this.audit(userId, "vet.registration.team.update", orgId, meta, { count: members.length });
    return this.buildState(orgId, "owner");
  }

  /**
   * Submit: accept the terms, freeze the record for review, and send every
   * staff invitation now (founder decision 2026-09-16). Invitees can create
   * their accounts immediately; the guard keeps them out of any member record
   * until the clinic is approved AND live.
   */
  async submit(userId: string, orgId: string, dto: RegistrationSubmitDto, meta: RequestMeta) {
    const org = await this.assertOwner(userId, orgId);
    if (org.status !== "REGISTERING" && org.status !== "CHANGES_REQUESTED") {
      throw new BadRequestException(
        vetError("VET_REG_WRONG_STATUS", "This registration can't be submitted in its current state.", {
          status: org.status,
        })
      );
    }
    if (dto.termsVersion !== VET_PARTNER_TERMS_VERSION) {
      throw new BadRequestException(
        vetError("VET_REG_TERMS_OUTDATED", "The terms have been updated — reload and read the current version.", {
          currentVersion: VET_PARTNER_TERMS_VERSION,
        })
      );
    }

    const state = await this.buildState(orgId, "owner");
    if (state.gaps.length > 0) {
      throw new BadRequestException(
        vetError("VET_REG_INCOMPLETE", "Some required details are still missing.", { gaps: state.gaps })
      );
    }

    const now = new Date();
    const resubmission = org.status === "CHANGES_REQUESTED";
    const contentHash = createHash("sha256")
      .update(canonicalTermsText([VET_PARTNER_AGREEMENT, VET_PDPL_ADDENDUM]))
      .digest("hex");

    await this.prisma.$transaction(async (tx) => {
      const latest = await tx.partnerAgreement.findFirst({
        where: { orgId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.partnerAgreement.create({
        data: {
          orgId,
          version: (latest?.version ?? 0) + 1,
          termsVersion: VET_PARTNER_TERMS_VERSION,
          contentHash,
          signedAt: now,
          signedByName: dto.signedByName,
          signedByTitle: dto.signedByTitle,
          acceptedByUserId: userId,
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent?.slice(0, 400) ?? null,
        },
      });
      await tx.partnerOrg.update({
        where: { id: orgId },
        data: {
          status: "SUBMITTED",
          submittedAt: now,
          changesRequestedNote: null,
          changesRequestedSteps: [],
        },
      });
      // The owner's signature covers the confidentiality duties in the addendum.
      await tx.partnerStaff.updateMany({
        where: { orgId, userId },
        data: { confidentialityAcceptedAt: now, confidentialityVersion: VET_STAFF_CONFIDENTIALITY_VERSION },
      });
    });

    const { sent: invitesSent, devTokens } = await this.sendTeamInvites(orgId, userId);

    await this.audit(userId, resubmission ? "vet.registration.resubmit" : "vet.registration.submit", orgId, meta, {
      termsVersion: VET_PARTNER_TERMS_VERSION,
      contentHash,
      invitesSent,
    });

    const owner = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (owner) {
      await this.sendMail(owner.email, {
        subjectAr: `استلمنا تسجيل ${state.org.nameAr}`,
        subjectEn: `We've received ${state.org.nameEn}'s registration`,
        headingAr: "وصلنا طلبك — شكراً لك",
        headingEn: "Your registration is in — thank you",
        bodyAr: [
          "فريق شراكات مرقط يراجع كل مستند بنفسه. نرد عليك خلال ٥–٧ أيام عمل، وسنراسلك عند كل خطوة.",
          invitesSent > 0
            ? `أرسلنا دعوات الانضمام إلى ${invitesSent} من فريقك. يستطيعون إنشاء حساباتهم الآن، ويبدأ العمل بعد الموافقة.`
            : "لم يكن هناك أعضاء فريق جدد لدعوتهم.",
        ],
        bodyEn: [
          "The Moracat partnerships team checks every document by hand. We'll reply within 5–7 working days and email you at every step.",
          invitesSent > 0
            ? `We've sent invitations to ${invitesSent} of your team. They can create their accounts now; work starts once you're approved.`
            : "There were no new team members to invite.",
        ],
        cta: { labelAr: "متابعة الطلب", labelEn: "Track your registration", url: `${siteUrl()}/vet/register` },
      });
    }
    await this.notifyPartnersTeam(
      resubmission ? "Registration resubmitted" : "New clinic registration",
      `${state.org.nameEn} / ${state.org.nameAr} — ${siteUrl()}/admin/partners/${orgId}`
    );

    const next = await this.buildState(orgId, "owner");
    return process.env.NODE_ENV !== "production" ? { ...next, devInviteTokens: devTokens } : next;
  }

  /** Invite every listed team member who doesn't already have a live invite or seat. */
  private async sendTeamInvites(
    orgId: string,
    invitedByUserId: string
  ): Promise<{ sent: number; devTokens: Record<string, string> }> {
    const devTokens: Record<string, string> = {};
    const org = await this.prisma.partnerOrg.findUnique({ where: { id: orgId }, select: { registrationTeam: true } });
    const team = ((org?.registrationTeam as unknown as RegistrationTeamMember[] | null) ?? []).filter(Boolean);
    let sent = 0;
    for (const m of team) {
      const [seat, liveInvite] = await Promise.all([
        this.prisma.partnerStaff.findFirst({
          where: { orgId, user: { email: m.email }, status: { in: ["ACTIVE", "SUSPENDED"] } },
          select: { id: true },
        }),
        this.prisma.partnerInvite.findFirst({
          where: { orgId, email: m.email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, role: m.role },
          select: { id: true },
        }),
      ]);
      if (seat || liveInvite) continue;
      try {
        const created = await this.staff.createInvite({
          orgId,
          email: m.email,
          role: m.role,
          invitedByUserId,
          branchIds: m.branchIds,
          title: m.title ?? undefined,
          fullName: m.fullName,
          phone: m.phone,
          licenceNo: m.licenceNo ?? null,
          licenceExpiresAt: m.licenceExpiresAt ? new Date(m.licenceExpiresAt) : null,
        });
        if ("devToken" in created && created.devToken) devTokens[m.email] = created.devToken;
        sent++;
      } catch (err) {
        // One bad address must not strand the whole team — the owner can resend.
        this.logger.error(`Invite for ${maskEmail(m.email)} at org ${orgId} failed: ${(err as Error).message}`);
      }
    }
    return { sent, devTokens };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Admin — review
  // ══════════════════════════════════════════════════════════════════════════

  async adminList(query: AdminOrgListQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const where: Prisma.PartnerOrgWhereInput = {
      ...(query.status ? { status: query.status as ClinicOrgStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { nameEn: { contains: query.q, mode: "insensitive" as const } },
              { nameAr: { contains: query.q } },
              { crNumber: { contains: query.q } },
              { contactEmail: { contains: query.q, mode: "insensitive" as const } },
              { contactName: { contains: query.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [rows, total, counts] = await Promise.all([
      this.prisma.partnerOrg.findMany({
        where,
        // Waiting on Moracat first, then newest.
        orderBy: [{ submittedAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip: (page - 1) * DEFAULT_LIMIT,
        take: DEFAULT_LIMIT,
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          status: true,
          tier: true,
          isDemo: true,
          verifiedAt: true,
          contactName: true,
          contactEmail: true,
          contactPhone: true,
          submittedAt: true,
          createdAt: true,
          updatedAt: true,
          testScanAt: true,
          goLiveRequestedAt: true,
          branches: { select: { cityCode: true, city: { select: { nameAr: true, nameEn: true } } }, take: 1 },
          registrationInvites: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { expiresAt: true, claimedAt: true, revokedAt: true },
          },
          _count: { select: { branches: true, staff: true } },
        },
      }),
      this.prisma.partnerOrg.count({ where }),
      this.prisma.partnerOrg.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    return {
      items: rows.map((o) => {
        const first = o.branches[0];
        const census = findSaudiCity(first?.cityCode);
        const inv = o.registrationInvites[0];
        return {
          id: o.id,
          nameAr: o.nameAr,
          nameEn: o.nameEn,
          status: o.status,
          statusLabel: CLINIC_STATUS_LABELS[o.status as ClinicOrgStatus],
          tier: o.tier,
          isDemo: o.isDemo,
          verified: !!o.verifiedAt,
          contactName: o.contactName,
          contactEmail: o.contactEmail,
          contactPhone: o.contactPhone,
          city: first?.city ?? (census ? { nameAr: census.ar, nameEn: census.en } : null),
          branchCount: o._count.branches,
          staffCount: o._count.staff,
          submittedAt: o.submittedAt,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          testScanAt: o.testScanAt,
          goLiveRequestedAt: o.goLiveRequestedAt,
          invite: inv
            ? {
                expiresAt: inv.expiresAt,
                claimed: !!inv.claimedAt,
                revoked: !!inv.revokedAt,
                expired: !inv.claimedAt && inv.expiresAt.getTime() <= Date.now(),
              }
            : null,
        };
      }),
      statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      pagination: { page, limit: DEFAULT_LIMIT, total, totalPages: Math.max(1, Math.ceil(total / DEFAULT_LIMIT)) },
    };
  }

  async adminDetail(orgId: string) {
    await this.loadOrg(orgId);
    return this.buildState(orgId, "admin");
  }

  async adminDocumentFile(orgId: string, documentId: string) {
    return this.readDocument(orgId, documentId);
  }

  async setDocumentVerified(actorId: string, orgId: string, documentId: string, verified: boolean, meta: RequestMeta) {
    const doc = await this.findDocument(orgId, documentId);
    const data = verified ? { verifiedAt: new Date(), verifiedById: actorId } : { verifiedAt: null, verifiedById: null };
    if (doc.scope === "org") await this.prisma.orgDocument.update({ where: { id: doc.id }, data });
    else await this.prisma.branchDocument.update({ where: { id: doc.id }, data });
    await this.audit(actorId, verified ? "vet.registration.document.verify" : "vet.registration.document.unverify", orgId, meta, {
      documentId,
      kind: doc.kind,
    });
    return this.buildState(orgId, "admin");
  }

  async requestChanges(actorId: string, orgId: string, dto: RequestChangesDto, meta: RequestMeta) {
    const org = await this.assertReviewable(orgId);
    await this.prisma.partnerOrg.update({
      where: { id: orgId },
      data: {
        status: "CHANGES_REQUESTED",
        changesRequestedNote: dto.note,
        changesRequestedSteps: dto.steps,
        reviewedAt: new Date(),
        reviewedById: actorId,
      },
    });
    await this.audit(actorId, "vet.registration.changes_requested", orgId, meta, { steps: dto.steps });
    await this.emailOwners(orgId, {
      subjectAr: `مطلوب تعديلات على تسجيل ${org.nameAr}`,
      subjectEn: `Changes needed on ${org.nameEn}'s registration`,
      headingAr: "نحتاج بعض التعديلات قبل الموافقة",
      headingEn: "We need a few changes before approval",
      bodyAr: ["راجعنا طلبك ونحتاج منك التالي. عدّل الأقسام المفتوحة ثم أعد الإرسال — بقية بياناتك محفوظة كما هي."],
      bodyEn: ["We've reviewed your registration and need the following. Update the reopened sections and resubmit — everything else is saved."],
      quote: dto.note,
      cta: { labelAr: "تعديل الطلب", labelEn: "Update registration", url: `${siteUrl()}/vet/register` },
    });
    return this.buildState(orgId, "admin");
  }

  /**
   * Approve: requires every required document to have been checked by a human.
   * Approval also marks the org verified — the directory badge means exactly
   * "Moracat read these papers". The clinic lands in APPROVED (setup sandbox);
   * going live is a separate act gated on the test scan.
   */
  async approve(actorId: string, orgId: string, dto: ReviewNoteDto, meta: RequestMeta) {
    const org = await this.assertReviewable(orgId);
    const state = await this.buildState(orgId, "admin");
    if (state.gaps.length > 0) {
      throw new BadRequestException(
        vetError("VET_REG_INCOMPLETE", "This registration is missing required details.", { gaps: state.gaps })
      );
    }
    const unverified = state.documents.filter((d) => d.required && !d.verified);
    if (unverified.length > 0) {
      throw new BadRequestException(
        vetError("VET_REG_DOCS_UNVERIFIED", "Check and verify every required document before approving.", {
          documents: unverified.map((d) => ({ id: d.id, kind: d.kind, branchId: d.branchId })),
        })
      );
    }
    const now = new Date();
    await this.prisma.partnerOrg.update({
      where: { id: orgId },
      data: { status: "APPROVED", verifiedAt: now, reviewedAt: now, reviewedById: actorId },
    });
    await this.audit(actorId, "vet.registration.approve", orgId, meta, { note: dto.note ?? null });
    await this.emailClinicTeam(orgId, {
      subjectAr: `تمت الموافقة على ${org.nameAr} في شبكة مرقط`,
      subjectEn: `${org.nameEn} is approved on Moracat`,
      headingAr: "مبروك — تمت الموافقة على عيادتكم",
      headingEn: "Congratulations — your clinic is approved",
      bodyAr: [
        "خطوة أخيرة قبل ظهوركم للأعضاء: جهّزوا جهاز الاستقبال وأجروا مسحاً تجريبياً واحداً ناجحاً من بوابة العيادات.",
        "بعدها نفعّل العيادة وتظهر في دليل مرقط.",
      ],
      bodyEn: [
        "One last step before members can see you: set up the counter device and run one successful test scan in the partner portal.",
        "Then we switch the clinic live and it appears in the Moracat directory.",
      ],
      cta: { labelAr: "افتح بوابة العيادات", labelEn: "Open the partner portal", url: `${siteUrl()}/vet` },
    });
    return this.buildState(orgId, "admin");
  }

  async reject(actorId: string, orgId: string, dto: RejectRegistrationDto, meta: RequestMeta) {
    const org = await this.loadOrg(orgId);
    if (!["REGISTERING", "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"].includes(org.status)) {
      throw new BadRequestException(
        vetError("VET_REG_WRONG_STATUS", "Only a registration still in review can be rejected.", { status: org.status })
      );
    }
    await this.prisma.$transaction([
      this.prisma.partnerOrg.update({
        where: { id: orgId },
        data: { status: "REJECTED", rejectedReason: dto.reason, reviewedAt: new Date(), reviewedById: actorId },
      }),
      this.prisma.partnerInvite.updateMany({
        where: { orgId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit(actorId, "vet.registration.reject", orgId, meta, { reason: dto.reason });
    await this.emailOwners(orgId, {
      subjectAr: `بخصوص تسجيل ${org.nameAr}`,
      subjectEn: `About ${org.nameEn}'s registration`,
      headingAr: "لم نتمكن من قبول التسجيل",
      headingEn: "We couldn't approve this registration",
      bodyAr: ["شكراً لاهتمامكم بشبكة مرقط. السبب:"],
      bodyEn: ["Thank you for your interest in the Moracat network. The reason:"],
      quote: dto.reason,
      footnoteAr: "لأي استفسار راسلنا على support@moracat.co",
      footnoteEn: "Questions? Write to support@moracat.co",
    });
    return this.buildState(orgId, "admin");
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Go-live checklist (phase 5) — acting as clinic staff
  // ══════════════════════════════════════════════════════════════════════════

  async onboarding(orgId: string) {
    const [org, devices, staff, testCat] = await Promise.all([
      this.prisma.partnerOrg.findUnique({
        where: { id: orgId },
        select: {
          status: true,
          verifiedAt: true,
          isDemo: true,
          branchesConfirmedAt: true,
          testScanAt: true,
          goLiveRequestedAt: true,
        },
      }),
      this.prisma.counterDevice.count({ where: { branch: { orgId }, revokedAt: null } }),
      this.prisma.partnerStaff.findMany({
        where: { orgId, status: "ACTIVE" },
        select: { pinHash: true },
      }),
      this.findTestCat(),
    ]);
    if (!org) throw new NotFoundException(vetError("VET_ORG_NOT_FOUND", "Clinic not found."));
    const pins = staff.filter((s) => !!s.pinHash).length;
    const items = {
      branches: { done: !!org.branchesConfirmedAt, at: org.branchesConfirmedAt },
      device: { done: devices > 0, count: devices },
      pins: { done: pins > 0, count: pins, of: staff.length },
      testScan: { done: !!org.testScanAt, at: org.testScanAt },
    };
    const ready = items.branches.done && items.device.done && items.testScan.done;
    return {
      status: org.status,
      verified: !!org.verifiedAt,
      items,
      ready,
      goLiveRequestedAt: org.goLiveRequestedAt,
      testCat,
    };
  }

  async confirmBranches(orgId: string, userId: string, meta: RequestMeta) {
    await this.prisma.partnerOrg.update({ where: { id: orgId }, data: { branchesConfirmedAt: new Date() } });
    await this.audit(userId, "vet.onboarding.branches.confirm", orgId, meta, {});
    return this.onboarding(orgId);
  }

  async requestGoLive(orgId: string, userId: string, meta: RequestMeta) {
    const state = await this.onboarding(orgId);
    if (state.status !== "APPROVED") {
      throw new BadRequestException(vetError("VET_REG_WRONG_STATUS", "Only an approved clinic can ask to go live.", { status: state.status }));
    }
    if (!state.ready) {
      throw new BadRequestException(vetError("VET_GO_LIVE_NOT_READY", "Finish the checklist first.", { items: state.items }));
    }
    if (!state.goLiveRequestedAt) {
      await this.prisma.partnerOrg.update({ where: { id: orgId }, data: { goLiveRequestedAt: new Date() } });
      await this.audit(userId, "vet.onboarding.golive.request", orgId, meta, {});
      const org = await this.prisma.partnerOrg.findUnique({ where: { id: orgId }, select: { nameAr: true, nameEn: true } });
      await this.notifyPartnersTeam("Clinic ready to go live", `${org?.nameEn} / ${org?.nameAr} — ${siteUrl()}/admin/partners/${orgId}`);
    }
    return this.onboarding(orgId);
  }

  /** Called from patient search: an approved clinic just found a demo cat. */
  async recordTestScan(orgId: string) {
    await this.prisma.partnerOrg.updateMany({
      where: { id: orgId, status: "APPROVED", testScanAt: null },
      data: { testScanAt: new Date() },
    });
  }

  /** A demo cat for the test scan — seeded by db:seed:vet-demo, never a real member. */
  private async findTestCat() {
    const cat = await this.prisma.cat.findFirst({
      where: { isDemo: true, deletedAt: null, OR: [{ microchipNo: { not: null } }, { catIdNumber: { not: null } }] },
      orderBy: [{ microchipNo: "asc" }],
      select: { name: true, microchipNo: true, catIdNumber: true },
    });
    return cat ? { name: cat.name, microchipNo: cat.microchipNo, catIdNumber: cat.catIdNumber } : null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  State
  // ══════════════════════════════════════════════════════════════════════════

  private async buildState(orgId: string, view: "owner" | "admin") {
    const org = await this.prisma.partnerOrg.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        slug: true,
        status: true,
        tier: true,
        isDemo: true,
        nameAr: true,
        nameEn: true,
        legalNameAr: true,
        legalNameEn: true,
        crNumber: true,
        unifiedNumber: true,
        crExpiresAt: true,
        vatNumber: true,
        logoUrl: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        inviteNote: true,
        submittedAt: true,
        reviewedAt: true,
        verifiedAt: true,
        suspendedAt: true,
        suspendReason: true,
        changesRequestedNote: true,
        changesRequestedSteps: true,
        rejectedReason: true,
        registrationTeam: true,
        branchesConfirmedAt: true,
        testScanAt: true,
        goLiveRequestedAt: true,
        createdAt: true,
        branches: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            cityCode: true,
            district: true,
            addressLine: true,
            nationalAddressCode: true,
            lat: true,
            lng: true,
            mapsUrl: true,
            phone: true,
            email: true,
            hours: true,
            emergency24h: true,
            services: true,
            licenceNo: true,
            licenceExpiresAt: true,
            directoryVisible: true,
            isActive: true,
            documents: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                kind: true,
                fileName: true,
                mimeType: true,
                sizeBytes: true,
                number: true,
                expiresAt: true,
                verifiedAt: true,
                createdAt: true,
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            kind: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            number: true,
            expiresAt: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
        agreements: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            version: true,
            termsVersion: true,
            contentHash: true,
            signedAt: true,
            signedByName: true,
            signedByTitle: true,
            ipAddress: true,
          },
        },
        registrationInvites: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { email: true, expiresAt: true, claimedAt: true, revokedAt: true, createdAt: true },
        },
        invites: {
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, role: true, fullName: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true },
        },
        staff: {
          where: { status: { not: "OFFBOARDED" } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            status: true,
            title: true,
            licenceNo: true,
            licenceExpiresAt: true,
            confidentialityAcceptedAt: true,
            pinHash: true,
            joinedAt: true,
            user: { select: { email: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
    });
    if (!org) throw new NotFoundException(vetError("VET_ORG_NOT_FOUND", "Clinic not found."));

    const status = org.status as ClinicOrgStatus;
    const team = ((org.registrationTeam as unknown as RegistrationTeamMember[] | null) ?? []).filter(Boolean);
    const owner = org.staff.find((s) => s.role === "OWNER");

    const documents = [
      ...org.documents.map((d) => ({
        ...d,
        scope: "org" as DocScope,
        branchId: null as string | null,
        required: d.kind === "CR",
      })),
      ...org.branches.flatMap((b) =>
        b.documents.map((d) => ({ ...d, scope: "branch" as DocScope, branchId: b.id, required: d.kind === "MEWA_LICENCE" }))
      ),
    ].map((d) => ({
      id: d.id,
      scope: d.scope,
      kind: d.kind as ClinicDocumentKind,
      label: CLINIC_DOCUMENT_LABELS[d.kind as ClinicDocumentKind],
      branchId: d.branchId,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      number: d.number,
      expiresAt: d.expiresAt,
      verified: !!d.verifiedAt,
      verifiedAt: d.verifiedAt,
      required: d.required,
      createdAt: d.createdAt,
    }));

    const gaps = registrationGaps({
      owner: {
        claimed: !!owner && owner.status === "ACTIVE",
        // Stored as the owner seat's licence: present = the owner practises.
        practisesAsVet: !!owner?.licenceNo,
        licenceNo: owner?.licenceNo ?? null,
      },
      clinic: {
        nameAr: org.nameAr,
        nameEn: org.nameEn,
        legalNameAr: org.legalNameAr,
        crNumber: org.crNumber,
        unifiedNumber: org.unifiedNumber,
        crExpiresAt: org.crExpiresAt,
      },
      branches: org.branches.map((b) => ({ ...b })),
      documents: documents.map((d) => ({ kind: d.kind, branchId: d.branchId })),
      team: team.map((m) => ({ role: m.role, licenceNo: m.licenceNo })),
    });

    const editableSteps = editableStepsFor(status, org.changesRequestedSteps as RegistrationStep[]);
    const agreement = org.agreements[0] ?? null;
    const now = Date.now();

    const base = {
      org: {
        id: org.id,
        slug: org.slug,
        status,
        statusLabel: CLINIC_STATUS_LABELS[status],
        tier: org.tier,
        nameAr: org.nameAr,
        nameEn: org.nameEn,
        legalNameAr: org.legalNameAr,
        legalNameEn: org.legalNameEn,
        crNumber: org.crNumber,
        unifiedNumber: org.unifiedNumber,
        crExpiresAt: org.crExpiresAt,
        vatNumber: org.vatNumber,
        logoUrl: org.logoUrl,
        contactName: org.contactName,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
        submittedAt: org.submittedAt,
        reviewedAt: org.reviewedAt,
        verified: !!org.verifiedAt,
        changesRequestedNote: org.changesRequestedNote,
        changesRequestedSteps: org.changesRequestedSteps,
        rejectedReason: org.rejectedReason,
        createdAt: org.createdAt,
      },
      editableSteps,
      branches: org.branches.map((b) => {
        const census = findSaudiCity(b.cityCode);
        return {
          id: b.id,
          nameAr: b.nameAr,
          nameEn: b.nameEn,
          cityCode: b.cityCode,
          city: census ? { code: census.code, ar: census.ar, en: census.en } : null,
          district: b.district,
          addressLine: b.addressLine,
          nationalAddressCode: b.nationalAddressCode,
          lat: b.lat,
          lng: b.lng,
          mapsUrl: b.mapsUrl,
          phone: b.phone,
          email: b.email,
          hours: (b.hours as unknown as { day: number; open?: string; close?: string; closed?: boolean }[] | null) ?? [],
          emergency24h: b.emergency24h,
          services: b.services,
          licenceNo: b.licenceNo,
          licenceExpiresAt: b.licenceExpiresAt,
          directoryVisible: b.directoryVisible,
          isActive: b.isActive,
        };
      }),
      documents,
      team,
      invites: org.invites
        .filter((i) => !i.revokedAt || i.acceptedAt)
        .map((i) => ({
          id: i.id,
          email: i.email,
          fullName: i.fullName,
          role: i.role as VetRole,
          roleLabel: VET_ROLE_LABELS[i.role as VetRole],
          state: i.acceptedAt ? "accepted" : i.expiresAt.getTime() <= now ? "expired" : "pending",
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
        })),
      terms: {
        currentVersion: VET_PARTNER_TERMS_VERSION,
        accepted: agreement
          ? {
              version: agreement.version,
              termsVersion: agreement.termsVersion,
              signedAt: agreement.signedAt,
              signedByName: agreement.signedByName,
              signedByTitle: agreement.signedByTitle,
            }
          : null,
      },
      gaps,
      owner: owner
        ? {
            name: [owner.user.firstName, owner.user.lastName].filter(Boolean).join(" ") || null,
            email: owner.user.email,
            practisesAsVet: !!owner.licenceNo,
            licenceNo: owner.licenceNo,
            licenceExpiresAt: owner.licenceExpiresAt,
            title: owner.title,
          }
        : null,
    };

    if (view === "owner") return { ...base, admin: null };

    const inv = org.registrationInvites[0];
    return {
      ...base,
      admin: {
        isDemo: org.isDemo,
        inviteNote: org.inviteNote,
        suspendedAt: org.suspendedAt,
        suspendReason: org.suspendReason,
        agreement: agreement
          ? { ...agreement, contentHash: agreement.contentHash, ipAddress: agreement.ipAddress }
          : null,
        registrationInvite: inv
          ? {
              email: inv.email,
              createdAt: inv.createdAt,
              expiresAt: inv.expiresAt,
              claimedAt: inv.claimedAt,
              revokedAt: inv.revokedAt,
              expired: !inv.claimedAt && inv.expiresAt.getTime() <= now,
            }
          : null,
        staff: org.staff.map((s) => ({
          id: s.id,
          role: s.role as VetRole,
          roleLabel: VET_ROLE_LABELS[s.role as VetRole],
          status: s.status,
          name: [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") || null,
          email: s.user.email,
          phone: s.user.phone,
          title: s.title,
          licenceNo: s.licenceNo,
          licenceExpiresAt: s.licenceExpiresAt,
          confidentialityAccepted: !!s.confidentialityAcceptedAt,
          hasCounterPin: !!s.pinHash,
          joinedAt: s.joinedAt,
        })),
        checklist: {
          branchesConfirmedAt: org.branchesConfirmedAt,
          testScanAt: org.testScanAt,
          goLiveRequestedAt: org.goLiveRequestedAt,
        },
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Helpers
  // ══════════════════════════════════════════════════════════════════════════

  private async loadOrg(orgId: string) {
    const org = await this.prisma.partnerOrg.findUnique({
      where: { id: orgId },
      select: { id: true, status: true, nameAr: true, nameEn: true, contactEmail: true, changesRequestedSteps: true },
    });
    if (!org) throw new NotFoundException(vetError("VET_ORG_NOT_FOUND", "Clinic not found."));
    return org;
  }

  private async assertOwner(userId: string, orgId: string) {
    const seat = await this.prisma.partnerStaff.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: { role: true, status: true },
    });
    if (!seat || seat.role !== "OWNER" || seat.status !== "ACTIVE") {
      throw new ForbiddenException(vetError("VET_NOT_STAFF", "Only the clinic owner can manage this registration."));
    }
    return this.loadOrg(orgId);
  }

  private async assertEditable(userId: string, orgId: string, step: RegistrationStep) {
    const org = await this.assertOwner(userId, orgId);
    const steps = editableStepsFor(org.status as ClinicOrgStatus, org.changesRequestedSteps as RegistrationStep[]);
    if (!steps.includes(step)) {
      throw new BadRequestException(
        vetError(
          "VET_REG_LOCKED",
          org.status === "SUBMITTED" || org.status === "IN_REVIEW"
            ? "Your registration is with Moracat for review — it can't be edited right now."
            : "This section isn't open for changes.",
          { status: org.status, step }
        )
      );
    }
    return org;
  }

  private async assertReviewable(orgId: string) {
    const org = await this.loadOrg(orgId);
    if (!REGISTRATION_REVIEWABLE_STATUSES.includes(org.status as ClinicOrgStatus)) {
      throw new BadRequestException(
        vetError("VET_REG_WRONG_STATUS", "This clinic isn't waiting for review.", { status: org.status })
      );
    }
    return org;
  }

  private async findDocument(orgId: string, documentId: string) {
    const orgDoc = await this.prisma.orgDocument.findFirst({
      where: { id: documentId, orgId },
      select: { id: true, kind: true, fileKey: true, fileName: true, mimeType: true },
    });
    if (orgDoc) {
      return { scope: "org" as DocScope, id: orgDoc.id, kind: orgDoc.kind, key: orgDoc.fileKey, fileName: orgDoc.fileName, mimeType: orgDoc.mimeType };
    }
    const branchDoc = await this.prisma.branchDocument.findFirst({
      where: { id: documentId, branch: { orgId } },
      select: { id: true, kind: true, fileUrl: true, fileName: true, mimeType: true },
    });
    if (branchDoc) {
      return {
        scope: "branch" as DocScope,
        id: branchDoc.id,
        kind: branchDoc.kind,
        key: branchDoc.fileUrl,
        fileName: branchDoc.fileName ?? "document",
        mimeType: branchDoc.mimeType ?? "application/octet-stream",
      };
    }
    throw new NotFoundException(vetError("VET_DOC_NOT_FOUND", "Document not found."));
  }

  private async readDocument(orgId: string, documentId: string) {
    const doc = await this.findDocument(orgId, documentId);
    if (!doc.key.startsWith("private/")) {
      // A legacy branch document stored as a URL — never proxy arbitrary URLs.
      throw new NotFoundException(vetError("VET_DOC_NOT_FOUND", "This document isn't stored privately."));
    }
    const buffer = await this.storage.getPrivate(doc.key);
    return { buffer, mimeType: doc.mimeType, fileName: doc.fileName };
  }

  private async uniqueSlug(source: string): Promise<string> {
    const base =
      source
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60) || `clinic-${randomBytes(3).toString("hex")}`;
    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? base : `${base}-${n + 1}`;
      const taken = await this.prisma.partnerOrg.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${base}-${randomBytes(3).toString("hex")}`;
  }

  private async emailOwners(orgId: string, notice: Parameters<typeof buildVetNoticeEmail>[0]) {
    const owners = await this.prisma.partnerStaff.findMany({
      where: { orgId, role: "OWNER", status: "ACTIVE" },
      select: { user: { select: { email: true } } },
    });
    const org = await this.prisma.partnerOrg.findUnique({ where: { id: orgId }, select: { contactEmail: true } });
    const to = new Set(owners.map((o) => o.user.email.toLowerCase()));
    if (to.size === 0 && org?.contactEmail) to.add(org.contactEmail);
    for (const email of to) await this.sendMail(email, notice);
  }

  private async emailClinicTeam(orgId: string, notice: Parameters<typeof buildVetNoticeEmail>[0]) {
    const staff = await this.prisma.partnerStaff.findMany({
      where: { orgId, status: "ACTIVE" },
      select: { user: { select: { email: true } } },
    });
    for (const email of new Set(staff.map((s) => s.user.email.toLowerCase()))) await this.sendMail(email, notice);
  }

  async sendMail(to: string, notice: Parameters<typeof buildVetNoticeEmail>[0]) {
    const built = buildVetNoticeEmail(notice);
    try {
      const res = await this.mail.send({ to, subject: built.subject, html: built.html, text: built.text });
      if (!res.ok) this.logger.error(`Registration email to ${maskEmail(to)} was not sent.`);
    } catch (err) {
      // An email hiccup must never undo a state change that really happened.
      this.logger.error(`Registration email to ${maskEmail(to)} failed: ${(err as Error).message}`);
    }
  }

  /** Optional ops inbox for "something is waiting for a human" signals. */
  private async notifyPartnersTeam(subject: string, line: string) {
    const to = process.env.PARTNERS_NOTIFY_EMAIL;
    if (!to) return;
    try {
      await this.mail.send({ to, subject: `[Moracat partners] ${subject}`, text: line, html: `<p>${line}</p>` });
    } catch (err) {
      this.logger.warn(`Partners-team notification failed: ${(err as Error).message}`);
    }
  }

  private async audit(actorId: string, action: string, orgId: string, meta: RequestMeta, metadata: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action,
        entityType: "PartnerOrg",
        entityId: orgId,
        metadata: metadata as Prisma.InputJsonValue,
        ipAddress: meta.ipAddress,
      },
    });
  }
}

/** Which wizard steps the owner may edit in a given state. */
export function editableStepsFor(status: ClinicOrgStatus, reopened: RegistrationStep[]): RegistrationStep[] {
  if (status === "INVITED" || status === "REGISTERING") return ["clinic", "branches", "documents", "team", "terms"];
  if (status === "CHANGES_REQUESTED") return [...reopened, "terms"];
  return [];
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

function safeFileName(original: string, ext: string): string {
  // Multer (busboy) decodes multipart filenames as latin1, so an Arabic name
  // like "السجل.pdf" arrives as mojibake. Re-decode as UTF-8 — but only when
  // the result round-trips, so a genuinely latin1 name is left alone.
  let name = original || "document";
  try {
    const utf8 = Buffer.from(name, "latin1").toString("utf8");
    if (!utf8.includes("�") && Buffer.from(utf8, "utf8").toString("latin1") === name) name = utf8;
  } catch {
    /* keep the original */
  }
  const stem = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .trim()
    .slice(0, 80);
  return `${stem || "document"}.${ext}`;
}

export { REGISTRATION_EDITABLE_STATUSES };
