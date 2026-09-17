/**
 * Clinic-created patients and their claim links — MRC-PROD-001 T4.
 *
 * The break this closes: a clinic could only write about cats already on
 * Moracat, so most walk-ins could not be recorded and the record network never
 * started. Now reception registers the cat in thirty seconds, the vet writes
 * the visit immediately, and the owner receives a link that turns the record
 * into their Cat ID.
 *
 * Rules that are code here, not copy:
 *   • A not-yet-live clinic cannot create real cats (capability is outside the
 *     setup sandbox); a demo clinic creates demo cats (quarantine holds).
 *   • The cat is owned by the placeholder account until claimed; every
 *     owner-facing send skips that account.
 *   • The token is stored hashed and shown once. Refreshing mints a new one
 *     and revokes the previous. SMS is gated by CLAIM_SMS_ENABLED and capped.
 *   • Creating the cat opens an intake Visit, so the treatment relationship
 *     every clinical write requires is real, not special-cased.
 */
import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import {
  CLAIM_RESEND_COOLDOWN_MS,
  CLAIM_TTL_DAYS,
  MAX_CLAIM_SENDS,
  claimPath,
  claimSmsText,
  claimState,
  normalizeSaudiPhone,
  phoneLast4,
} from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { IdsService } from "../ids/ids.service";
import { SmsService } from "../sms/sms.service";
import { EventsService } from "../events/events.service";
import { normalizeName } from "../common/text";
import { PlaceholderOwnerService } from "./placeholder-owner.service";
import { VetPatientsService, vetBadRequest, vetNotFound, type VetActor } from "./vet-patients.service";
import type { CreatePatientDto, RefreshClaimDto } from "./dto/vet-patient.dto";

const DAY_MS = 86_400_000;

export function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashClaimPhone(phone: string): string {
  return createHash("sha256").update(`${phone}${process.env.CLAIM_HASH_SALT ?? ""}`).digest("hex");
}

const claimSmsEnabled = () => process.env.CLAIM_SMS_ENABLED === "true";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

@Injectable()
export class VetClaimsService {
  private readonly logger = new Logger("VetClaims");

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly sms: SmsService,
    private readonly events: EventsService,
    private readonly placeholder: PlaceholderOwnerService,
    private readonly patients: VetPatientsService
  ) {}

  async createPatient(actor: VetActor, dto: CreatePatientDto) {
    const phone = normalizeSaudiPhone(dto.ownerPhone);
    if (!phone) {
      throw vetBadRequest("VET_PAYLOAD_INVALID", "Owner phone is not a valid mobile number", {
        hint: { ar: "اكتبوا رقم جوال المالك بصيغة 05XXXXXXXX.", en: "Enter the owner's mobile as 05XXXXXXXX." },
      });
    }
    const branch = await this.patients.requireBranchInScope(actor, dto.branchId ?? (await this.defaultBranchId(actor)));
    const nameNormalized = normalizeName(dto.name);

    // Already registered? A chip match, or the same owner phone with a cat of
    // the same name, means this cat exists — return it instead of a duplicate.
    const existing = await this.prisma.cat.findFirst({
      where: {
        deletedAt: null,
        isDemo: actor.orgIsDemo,
        OR: [
          ...(dto.microchipNo ? [{ microchipNo: dto.microchipNo }] : []),
          { nameNormalized, user: { phone } },
          { nameNormalized, claimInvites: { some: { phoneHash: hashClaimPhone(phone), claimedAt: null, revokedAt: null } } },
        ],
      },
      select: { id: true, name: true, catIdNumber: true, photoUrl: true, claimStatus: true },
    });
    if (existing) {
      return { created: false as const, match: existing };
    }

    const placeholderId = await this.placeholder.id();
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + CLAIM_TTL_DAYS * DAY_MS);

    const { cat, visit, invite } = await this.prisma.$transaction(async (tx) => {
      const cat = await tx.cat.create({
        data: {
          userId: placeholderId,
          name: dto.name,
          nameNormalized,
          gender: dto.gender ?? "UNKNOWN",
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          breedId: dto.breedId ?? null,
          microchipNo: dto.microchipNo ?? null,
          coatColor: dto.coatColor ?? null,
          origin: "CLINIC",
          claimStatus: "PENDING_CLAIM",
          isDemo: actor.orgIsDemo,
          isPublic: false,
          qrToken: await this.ids.newQrToken(),
          createdByOrgId: actor.orgId,
          createdByStaffId: actor.staffId,
          homeBranchId: branch?.id ?? null,
          cityCode: branch ? (await tx.branch.findUnique({ where: { id: branch.id }, select: { cityCode: true } }))?.cityCode ?? null : null,
        },
        select: { id: true, name: true, qrToken: true },
      });
      const visit = await tx.visit.create({
        data: {
          catId: cat.id,
          orgId: actor.orgId,
          branchId: branch?.id ?? null,
          mode: "STANDARD",
          reason: dto.reason ?? "New patient intake",
          openedById: actor.staffId,
        },
        select: { id: true, checkedInAt: true },
      });
      const invite = await tx.claimInvite.create({
        data: {
          catId: cat.id,
          orgId: actor.orgId,
          branchId: branch?.id ?? null,
          phone,
          phoneHash: hashClaimPhone(phone),
          phoneLast4: phoneLast4(phone),
          tokenHash: hashClaimToken(token),
          expiresAt,
          attestedByStaffId: actor.staffId,
          attestedAt: new Date(),
        },
        select: { id: true },
      });
      return { cat, visit, invite };
    });

    await this.patients.logAccess({ catId: cat.id, orgId: actor.orgId, staffId: actor.staffId, tier: "T1", surface: "write" });
    this.events.emit("clinic_patient_created", { orgId: actor.orgId, catId: cat.id, props: { branch: branch?.id ?? null, demo: actor.orgIsDemo } });

    const url = `${siteUrl()}${claimPath(token)}`;
    const sms = await this.maybeSendSms(invite.id, phone, cat.name, actor.orgId, url);

    const card = await this.prisma.cat.findUniqueOrThrow({ where: { id: cat.id }, select: this.patients.cardSelect });
    return {
      created: true as const,
      cat: { ...this.patients.cardOf(card), clinicRelationship: { isKnownPatient: true, visitCountHere: 1, lastVisitHere: visit.checkedInAt, openVisitId: visit.id } },
      visit: { id: visit.id },
      claim: { url, expiresAt, phoneLast4: phoneLast4(phone), smsSent: sms.sent, smsAvailable: claimSmsEnabled() },
    };
  }

  /** The claim state for the counter screen — never the token itself. */
  async getClaim(actor: VetActor, catId: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, deletedAt: null, isDemo: actor.orgIsDemo },
      select: { id: true, claimStatus: true, claimedAt: true, createdByOrgId: true },
    });
    if (!cat) throw vetNotFound("VET_PATIENT_NOT_FOUND", "No cat with that id");
    if (cat.claimStatus === "CLAIMED") return { state: "claimed" as const, claimedAt: cat.claimedAt };
    const invite = await this.prisma.claimInvite.findFirst({
      where: { catId, orgId: actor.orgId },
      orderBy: { createdAt: "desc" },
      select: { expiresAt: true, claimedAt: true, revokedAt: true, phoneLast4: true, sentCount: true, lastSentAt: true },
    });
    if (!invite) return { state: "none" as const, canCreate: cat.createdByOrgId === actor.orgId };
    return {
      state: claimState(invite),
      phoneLast4: invite.phoneLast4,
      expiresAt: invite.expiresAt,
      sentCount: invite.sentCount,
      lastSentAt: invite.lastSentAt,
      smsAvailable: claimSmsEnabled(),
      canResend: invite.sentCount < MAX_CLAIM_SENDS && (!invite.lastSentAt || Date.now() - invite.lastSentAt.getTime() > CLAIM_RESEND_COOLDOWN_MS),
    };
  }

  /**
   * Mint a fresh claim link (revoking the previous one) — for the counter QR
   * after a reload, or to re-send the SMS. Only the creating clinic may.
   */
  async refreshClaim(actor: VetActor, catId: string, dto: RefreshClaimDto) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, deletedAt: null, isDemo: actor.orgIsDemo, createdByOrgId: actor.orgId },
      select: { id: true, name: true, claimStatus: true },
    });
    if (!cat) throw vetNotFound("VET_PATIENT_NOT_FOUND", "No claimable cat with that id at this clinic");
    if (cat.claimStatus === "CLAIMED") {
      throw vetBadRequest("VET_PAYLOAD_INVALID", "This cat has already been claimed by its owner");
    }
    const previous = await this.prisma.claimInvite.findFirst({
      where: { catId, orgId: actor.orgId, claimedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!previous) throw vetNotFound("VET_PATIENT_NOT_FOUND", "No claim invite for this cat");

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + CLAIM_TTL_DAYS * DAY_MS);
    const invite = await this.prisma.$transaction(async (tx) => {
      await tx.claimInvite.updateMany({ where: { catId, revokedAt: null, claimedAt: null }, data: { revokedAt: new Date() } });
      return tx.claimInvite.create({
        data: {
          catId,
          orgId: actor.orgId,
          branchId: previous.branchId,
          phone: previous.phone,
          phoneHash: previous.phoneHash,
          phoneLast4: previous.phoneLast4,
          tokenHash: hashClaimToken(token),
          expiresAt,
          // The send budget follows the cat, not the token.
          sentCount: previous.sentCount,
          lastSentAt: previous.lastSentAt,
          attestedByStaffId: previous.attestedByStaffId,
          attestedAt: previous.attestedAt,
        },
        select: { id: true, phone: true, sentCount: true, lastSentAt: true },
      });
    });
    const url = `${siteUrl()}${claimPath(token)}`;
    const sms = dto.sendSms ? await this.maybeSendSms(invite.id, invite.phone, cat.name, actor.orgId, url, invite) : { sent: false, reason: "not_requested" as const };
    return { url, expiresAt, phoneLast4: previous.phoneLast4, smsSent: sms.sent, smsReason: sms.reason, smsAvailable: claimSmsEnabled() };
  }

  private async maybeSendSms(
    inviteId: string,
    phone: string,
    catName: string,
    orgId: string,
    url: string,
    budget?: { sentCount: number; lastSentAt: Date | null }
  ): Promise<{ sent: boolean; reason?: "disabled" | "cap" | "cooldown" | "provider" | "not_requested" }> {
    if (!claimSmsEnabled()) return { sent: false, reason: "disabled" };
    if (budget) {
      if (budget.sentCount >= MAX_CLAIM_SENDS) return { sent: false, reason: "cap" };
      if (budget.lastSentAt && Date.now() - budget.lastSentAt.getTime() < CLAIM_RESEND_COOLDOWN_MS) return { sent: false, reason: "cooldown" };
    }
    const org = await this.prisma.partnerOrg.findUnique({ where: { id: orgId }, select: { nameAr: true, nameEn: true } });
    const { queued } = await this.sms.send(phone, claimSmsText({ catName, clinicNameAr: org?.nameAr ?? "العيادة", clinicNameEn: org?.nameEn ?? "Your clinic", url }));
    await this.prisma.claimInvite.update({ where: { id: inviteId }, data: { sentCount: { increment: 1 }, lastSentAt: new Date() } });
    this.events.emit("claim_sent", { orgId, props: { queued } });
    if (!queued) this.logger.warn(`claim SMS not queued for invite ${inviteId}`);
    return { sent: queued, reason: queued ? undefined : "provider" };
  }

  /** A staff member scoped to exactly one branch works at that branch. */
  private async defaultBranchId(actor: VetActor): Promise<string | undefined> {
    if (actor.branchIds.length === 1) return actor.branchIds[0];
    if (actor.branchIds.length > 1) return undefined;
    const only = await this.prisma.branch.findMany({ where: { orgId: actor.orgId, isActive: true }, select: { id: true }, take: 2 });
    return only.length === 1 ? only[0]!.id : undefined;
  }
}
