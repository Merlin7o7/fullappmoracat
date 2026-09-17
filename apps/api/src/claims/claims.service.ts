/**
 * The owner's side of a clinic-created patient (MRC-PROD-001 T4).
 *
 * The clinic handed the owner a link. Following it shows what it is for
 * BEFORE asking for anything (R004): the cat's name, the clinic, the last four
 * digits of the number it went to, when it expires. Accepting needs proof of
 * that number — either the signed-in account already has it, or a one-time
 * code sent to it. Then the cat moves from the placeholder to the owner and
 * the Cat ID is issued: the same number, the same ceremony, just a different
 * door in (R031/R032).
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { claimState, normalizeSaudiPhone } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { IdsService } from "../ids/ids.service";
import { EventsService } from "../events/events.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthService } from "../auth/auth.service";
import { CatsService } from "../cats/cats.service";
import { hashClaimPhone, hashClaimToken } from "../vet/vet-claims.service";
import type { AcceptClaimDto } from "./dto/claim.dto";

const claimError = (code: string, message: string, hint?: { ar: string; en: string }, extra?: Record<string, unknown>) => ({
  code,
  message,
  ...(hint ? { hint } : {}),
  ...(extra ?? {}),
});

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
    private readonly auth: AuthService,
    private readonly cats: CatsService
  ) {}

  private async loadInvite(token: string) {
    const invite = await this.prisma.claimInvite.findUnique({
      where: { tokenHash: hashClaimToken(token) },
      include: {
        cat: { select: { id: true, name: true, photoUrl: true, claimStatus: true, isDemo: true, nameNormalized: true, deletedAt: true } },
      },
    });
    if (!invite || invite.cat.deletedAt) {
      throw new NotFoundException(
        claimError("CLAIM_NOT_FOUND", "No such claim link", {
          ar: "هذا الرابط غير صالح. اطلب من العيادة رابطاً جديداً.",
          en: "This link isn't valid. Ask the clinic for a new one.",
        })
      );
    }
    return invite;
  }

  /** Public preview — enough to decide, nothing that identifies the owner. */
  async preview(token: string) {
    const invite = await this.loadInvite(token);
    const org = await this.prisma.partnerOrg.findUnique({ where: { id: invite.orgId }, select: { nameAr: true, nameEn: true } });
    const state = invite.cat.claimStatus === "CLAIMED" ? "claimed" : claimState(invite);
    this.events.emit("claim_page_viewed", { catId: invite.catId, orgId: invite.orgId, props: { state } });
    return {
      state,
      cat: { name: invite.cat.name, photoUrl: invite.cat.photoUrl },
      clinic: { ar: org?.nameAr ?? "", en: org?.nameEn ?? "" },
      phoneLast4: invite.phoneLast4,
      expiresAt: invite.expiresAt,
    };
  }

  /** Send a one-time code to the invited number so a different account can prove it. */
  async sendOtp(token: string) {
    const invite = await this.loadInvite(token);
    if (invite.cat.claimStatus === "CLAIMED" || claimState(invite) !== "valid") {
      throw new BadRequestException(claimError("CLAIM_NOT_VALID", "This claim link is no longer valid"));
    }
    return this.auth.requestOtp({ phone: invite.phone, purpose: "VERIFY_PHONE" });
  }

  async accept(userId: string, token: string, dto: AcceptClaimDto) {
    const invite = await this.loadInvite(token);
    if (invite.cat.claimStatus === "CLAIMED") {
      throw new BadRequestException(
        claimError("CLAIM_ALREADY_CLAIMED", "This cat has already been claimed", {
          ar: "هذا القط مستلَم بالفعل. إن كان قطك ولم تستلمه أنت، تواصل معنا.",
          en: "This cat has already been claimed. If it's yours and you didn't claim it, contact us.",
        })
      );
    }
    if (claimState(invite) !== "valid") {
      throw new BadRequestException(
        claimError("CLAIM_NOT_VALID", "This claim link has expired or was replaced", {
          ar: "انتهت صلاحية الرابط. اطلب من العيادة إرسال رابط جديد.",
          en: "This link has expired. Ask the clinic to send a new one.",
        })
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, phone: true, phoneVerified: true, email: true, firstName: true, locale: true, primaryCatId: true },
    });

    // Proof of the invited number: the account already holds it, or a code.
    // The code is CHECKED here and CONSUMED only once the claim goes through,
    // so a "is this the same cat?" question never burns it.
    const accountPhone = user.phone ? normalizeSaudiPhone(user.phone) : null;
    let proven = !!accountPhone && hashClaimPhone(accountPhone) === invite.phoneHash;
    let otpToConsume: string | null = null;
    if (!proven && dto.phoneOtpCode) {
      const result = await this.auth.verifyPhoneOtp(invite.phone, "VERIFY_PHONE", dto.phoneOtpCode, { consume: false });
      if (result !== "valid") {
        throw new ForbiddenException(
          claimError("CLAIM_OTP_INVALID", `Code ${result}`, {
            ar: result === "expired" ? "انتهت صلاحية الرمز — اطلب رمزاً جديداً." : "الرمز غير صحيح.",
            en: result === "expired" ? "The code has expired — request a new one." : "That code isn't right.",
          })
        );
      }
      proven = true;
      otpToConsume = dto.phoneOtpCode;
    }
    if (!proven) {
      throw new ForbiddenException(
        claimError(
          "CLAIM_PHONE_MISMATCH",
          "The signed-in account does not hold the invited phone number",
          {
            ar: `هذا الحساب لا يحمل الرقم المنتهي بـ ${invite.phoneLast4}. أرسل رمز تحقق إلى ذلك الرقم لإثبات أنه لك.`,
            en: `This account doesn't hold the number ending in ${invite.phoneLast4}. Send a code to that number to prove it's yours.`,
          },
          { phoneLast4: invite.phoneLast4, needsOtp: true }
        )
      );
    }

    // "Is this one of your cats already?" — offer the merge before creating a twin.
    if (!dto.mergeIntoCatId) {
      const twins = await this.prisma.cat.findMany({
        where: { userId, deletedAt: null, claimStatus: "CLAIMED", nameNormalized: invite.cat.nameNormalized ?? undefined },
        select: { id: true, name: true, catIdNumber: true, photoUrl: true },
        take: 5,
      });
      if (twins.length && invite.cat.nameNormalized) {
        throw new BadRequestException(
          claimError(
            "CLAIM_POSSIBLE_DUPLICATE",
            "You already have a cat with this name",
            {
              ar: `عندك قط اسمه ${invite.cat.name} بالفعل. هل هذا هو نفسه؟`,
              en: `You already have a cat named ${invite.cat.name}. Is this the same cat?`,
            },
            { candidates: twins, needsDecision: true }
          )
        );
      }
    }

    let merged = false;
    let finalCatId = invite.catId;
    let catIdNumber: string | null = null;

    if (dto.mergeIntoCatId) {
      const target = await this.prisma.cat.findFirst({
        where: { id: dto.mergeIntoCatId, userId, deletedAt: null, claimStatus: "CLAIMED" },
        select: { id: true, catIdNumber: true },
      });
      if (!target) throw new NotFoundException(claimError("CLAIM_MERGE_TARGET_NOT_FOUND", "That cat isn't yours"));
      // Take ownership first so the merge is between two cats of the same owner.
      await this.prisma.$transaction(async (tx) => {
        await tx.cat.update({ where: { id: invite.catId }, data: { userId, claimStatus: "CLAIMED", claimedAt: new Date() } });
        await tx.claimInvite.update({ where: { id: invite.id }, data: { claimedAt: new Date(), claimedByUserId: userId } });
      });
      await this.cats.merge(invite.catId, target.id, { actorUserId: userId, reason: "claim" });
      merged = true;
      finalCatId = target.id;
      catIdNumber = target.catIdNumber;
    } else {
      catIdNumber = await this.ids.newCatId();
      await this.prisma.$transaction(async (tx) => {
        await tx.cat.update({
          where: { id: invite.catId },
          data: { userId, claimStatus: "CLAIMED", claimedAt: new Date(), catIdNumber, idIssuedAt: new Date() },
        });
        await tx.claimInvite.update({ where: { id: invite.id }, data: { claimedAt: new Date(), claimedByUserId: userId } });
        if (!user.primaryCatId) await tx.user.update({ where: { id: userId }, data: { primaryCatId: invite.catId } });
        // The code proved the number; keep it on the account if it's free.
        if (!user.phone && dto.phoneOtpCode) {
          const taken = await tx.user.findUnique({ where: { phone: invite.phone }, select: { id: true } });
          if (!taken) await tx.user.update({ where: { id: userId }, data: { phone: invite.phone, phoneVerified: new Date() } });
        }
      });
      this.notifications.emit(userId, {
        category: "COMMUNITY",
        type: "cat_id_issued",
        params: { name: invite.cat.name, catIdNumber },
        data: { kind: "cat_id_issued", catId: invite.catId, catIdNumber },
      });
      this.events.emit("cat_id_issued", { userId, catId: invite.catId, orgId: invite.orgId, props: { origin: "CLINIC" } });
    }

    // The claim went through — now the code is spent.
    if (otpToConsume) await this.auth.verifyPhoneOtp(invite.phone, "VERIFY_PHONE", otpToConsume, { consume: true });

    this.events.emit("claim_accepted", { userId, catId: finalCatId, orgId: invite.orgId, props: { merged } });
    return { catId: finalCatId, catIdNumber, merged, name: invite.cat.name };
  }
}
