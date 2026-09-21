/**
 * Cat ID ownership transfer — the hand-over that proves the ID belongs to the
 * CAT, not to the account holding it today (P09, R040 "the ID does a real job").
 *
 * THE PROMISE THIS FILE KEEPS
 *   · The Cat ID number never changes. Not on adoption, not on a gift, never.
 *   · The record travels with the cat: vaccinations, weights, clinic entries,
 *     certificates, photos, the census ordinal. The new owner inherits a life,
 *     not a blank form.
 *   · Provenance is kept forever (`CatOwnershipRecord`), because a medical
 *     record is only trustworthy if you can say who held the cat when each line
 *     was written.
 *   · The previous owner loses ownership-level access the instant the transfer
 *     lands — no lingering read, no lingering edit.
 *
 * WHY EVERY MUTATION IS INSIDE ONE $transaction
 * A cat with two owners, or none, is a corrupted identity. Acceptance moves the
 * cat, clears the old owner's primary-cat pointer, resets the privacy fields
 * that encoded the OLD owner's consent, revokes the clinic access grants the
 * old owner gave, appends provenance, closes the listing and cancels every
 * other pending offer — all or nothing. The status check is re-read INSIDE the
 * transaction, so two people racing the same link cannot both win.
 *
 * TWO CONFIRMATIONS, BY DESIGN (R116)
 *   1. The outgoing owner types the cat's name to start it (checked server-side).
 *   2. The incoming owner has to accept it from their own signed-in account,
 *      at the email address the offer was addressed to.
 * Neither side can hand a cat over by a single mis-tap.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import { EventsService } from "../events/events.service";
import { ownershipTransferTemplate, ownershipTransferDoneTemplate } from "../mail/mail.templates";
import type { StartTransferDto } from "./dto/ownership.dto";

/** A pending offer expires rather than hanging over a cat forever. */
const TRANSFER_TTL_DAYS = 14;

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type TransferDirection = "incoming" | "outgoing";

@Injectable()
export class OwnershipService {
  private readonly logger = new Logger("Ownership");

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly events: EventsService
  ) {}

  /* ──────────────────────────────────────────────────────────────────────
   * Starting a hand-over
   * ────────────────────────────────────────────────────────────────────*/

  /**
   * Offer a cat to someone by email. Idempotent per (cat, recipient): asking
   * twice refreshes the same offer rather than littering a cat with duplicates.
   *
   * `listingId` is set when the offer comes out of an accepted adoption
   * request, so accepting it closes the listing in the same transaction.
   */
  async start(
    ownerId: string,
    catId: string,
    dto: StartTransferDto,
    opts: { listingId?: string | null } = {}
  ) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, userId: ownerId, deletedAt: null },
      select: {
        id: true,
        name: true,
        catIdNumber: true,
        photoUrl: true,
        status: true,
        userId: true,
        user: { select: { firstName: true, email: true } },
      },
    });
    if (!cat) throw new NotFoundException("Cat not found");

    // Typing the name back is the confirmation (R116). Compared case- and
    // whitespace-insensitively — this is a "did you mean it?", not a spelling test.
    const typed = dto.confirmCatName.trim().toLocaleLowerCase();
    if (typed !== cat.name.trim().toLocaleLowerCase()) {
      throw new BadRequestException({
        code: "TRANSFER_NAME_MISMATCH",
        message: `Type ${cat.name}'s name exactly to confirm the transfer.`,
      });
    }

    if (cat.status === "DECEASED") {
      throw new BadRequestException({
        code: "TRANSFER_NOT_TRANSFERABLE",
        message: "A cat who has passed is kept with you, always. Their record is not transferred.",
      });
    }

    const toEmail = dto.toEmail.trim().toLowerCase();
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { email: true, firstName: true, locale: true },
    });
    if (owner?.email && owner.email.toLowerCase() === toEmail) {
      throw new BadRequestException({
        code: "TRANSFER_SELF",
        message: "That's your own email — this cat is already yours.",
      });
    }

    // An active subscription is money attached to the OLD owner's card. Moving
    // the cat under it would silently keep charging them for someone else's
    // cat, which is exactly the trust-killer R025 exists to prevent.
    const activeSub = await this.prisma.subscriptionCat.findFirst({
      where: { catId, subscription: { status: { in: ["ACTIVE", "PAST_DUE", "PAUSED"] } } },
      select: { subscriptionId: true },
    });
    if (activeSub) {
      throw new ConflictException({
        code: "TRANSFER_HAS_SUBSCRIPTION",
        message:
          "This cat is on an active membership. End or move the membership first, then hand over the Cat ID.",
      });
    }

    const recipient = await this.prisma.user.findUnique({
      where: { email: toEmail },
      select: { id: true, firstName: true, locale: true },
    });

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + TRANSFER_TTL_DAYS * 86_400_000);

    // One live offer per (cat, recipient). A second ask replaces the first.
    const existing = await this.prisma.catOwnershipTransfer.findFirst({
      where: { catId, toEmail, status: "PENDING" },
      select: { id: true },
    });

    const data = {
      catId,
      fromUserId: ownerId,
      toEmail,
      toUserId: recipient?.id ?? null,
      tokenHash: hashToken(token),
      status: "PENDING" as const,
      reason: dto.reason ?? "REHOME",
      note: dto.note ?? null,
      listingId: opts.listingId ?? null,
      expiresAt,
      cancelledAt: null,
      declinedAt: null,
    };

    const transfer = existing
      ? await this.prisma.catOwnershipTransfer.update({ where: { id: existing.id }, data })
      : await this.prisma.catOwnershipTransfer.create({ data });

    const url = `${siteUrl()}/transfer/${token}`;
    const fromName = owner?.firstName ?? null;

    // Tell the recipient on every channel we have them on.
    if (recipient) {
      this.notifications.emit(recipient.id, {
        category: "SYSTEM",
        type: "ownership_transfer_offered",
        params: { name: cat.name, from: fromName ?? "" },
        data: { kind: "ownership_transfer", catId, transferId: transfer.id, url },
      });
    }
    const loc = (recipient?.locale ?? owner?.locale ?? "ar") === "en" ? "en" : "ar";
    const tpl = ownershipTransferTemplate(loc, {
      catName: cat.name,
      catIdNumber: cat.catIdNumber,
      fromName,
      note: dto.note ?? null,
      url,
      expiresAt,
    });
    void this.mail
      .send({ to: toEmail, subject: tpl.subject, html: tpl.html, text: tpl.text })
      .catch((err: Error) => this.logger.warn(`transfer mail failed: ${err.message}`));

    this.events.emit("ownership_transfer_started", {
      userId: ownerId,
      catId,
      props: { reason: data.reason, recipientExists: !!recipient, fromListing: !!opts.listingId },
    });

    return {
      id: transfer.id,
      status: transfer.status,
      toEmail,
      recipientHasAccount: !!recipient,
      expiresAt,
      catName: cat.name,
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Reading
   * ────────────────────────────────────────────────────────────────────*/

  /** Everything in flight for this member, both directions. */
  async mine(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    });
    const email = user?.email?.toLowerCase() ?? "";
    // An address anyone can type is not proof of who they are: until the email
    // is confirmed, offers addressed to it stay out of this list (the emailed
    // link still works — holding it proves the inbox). See `assertRecipient`.
    const verified = !!user?.emailVerified;

    const [outgoing, incoming] = await Promise.all([
      this.prisma.catOwnershipTransfer.findMany({
        where: { fromUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: this.select(),
      }),
      verified
        ? this.prisma.catOwnershipTransfer.findMany({
            where: { OR: [{ toUserId: userId }, { toEmail: email }] },
            orderBy: { createdAt: "desc" },
            take: 40,
            select: this.select(),
          })
        : Promise.resolve([]),
    ]);

    return {
      outgoing: outgoing.map((t) => this.toCard(t, "outgoing")),
      incoming: incoming.map((t) => this.toCard(t, "incoming")),
    };
  }

  /**
   * What the link shows before anyone signs in: the cat, who is offering, and
   * whether the offer is still live. Never the owner's contact details — the
   * recipient already knows who this is, and a stranger with a guessed token
   * must learn nothing about a household.
   */
  async preview(token: string) {
    return this.previewRow({ tokenHash: hashToken(token) });
  }

  /** The same read model, keyed by id (after the caller has authorised it). */
  private previewById(id: string) {
    return this.previewRow({ id });
  }

  private async previewRow(where: Prisma.CatOwnershipTransferWhereUniqueInput) {
    const transfer = await this.prisma.catOwnershipTransfer.findUnique({
      where,
      select: {
        id: true,
        status: true,
        toEmail: true,
        expiresAt: true,
        note: true,
        reason: true,
        fromUser: { select: { firstName: true } },
        cat: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            catIdNumber: true,
            birthDate: true,
            gender: true,
            breed: { select: { nameAr: true, nameEn: true } },
            _count: { select: { vaccinations: true, clinicalEntries: true, photos: true } },
          },
        },
      },
    });
    if (!transfer) throw new NotFoundException({ code: "TRANSFER_NOT_FOUND", message: "This transfer link is not valid." });

    const state = this.liveState(transfer.status, transfer.expiresAt);
    return {
      id: transfer.id,
      status: state,
      // Masked: enough for the recipient to recognise their own address,
      // useless to anyone else.
      toEmailMasked: maskEmail(transfer.toEmail),
      expiresAt: transfer.expiresAt,
      note: transfer.note,
      reason: transfer.reason,
      fromName: transfer.fromUser.firstName,
      cat: {
        id: transfer.cat.id,
        name: transfer.cat.name,
        photoUrl: transfer.cat.photoUrl,
        catIdNumber: transfer.cat.catIdNumber,
        birthDate: transfer.cat.birthDate,
        gender: transfer.cat.gender,
        breed: transfer.cat.breed ? { ar: transfer.cat.breed.nameAr, en: transfer.cat.breed.nameEn } : null,
        // The inheritance, stated plainly — this is what "the record travels
        // with the cat" means in numbers (R003 value stays visible).
        history: {
          vaccinations: transfer.cat._count.vaccinations,
          clinicalEntries: transfer.cat._count.clinicalEntries,
          photos: transfer.cat._count.photos,
        },
      },
    };
  }

  /**
   * The same preview, for a signed-in recipient who reaches an offer through
   * their portal rather than the emailed link. Resolves by transfer id, and
   * only for the person the offer is addressed to.
   */
  async previewForRecipient(userId: string, userEmail: string, ref: string) {
    const transfer = await this.prisma.catOwnershipTransfer.findFirst({
      where: { OR: [{ id: ref }, { tokenHash: hashToken(ref) }] },
      select: { id: true, toEmail: true, toUserId: true, tokenHash: true },
    });
    if (!transfer) {
      throw new NotFoundException({ code: "TRANSFER_NOT_FOUND", message: "This transfer is not valid." });
    }
    await this.assertRecipient(transfer, ref, userId, userEmail, "see it");
    // Reuse the one read model, keyed by the row we just authorised.
    return this.previewById(transfer.id);
  }

  /** The cat's provenance chain — who held them, and when. Owner-only. */
  async history(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, userId, deletedAt: null },
      select: { id: true, createdAt: true },
    });
    if (!cat) throw new NotFoundException("Cat not found");
    const rows = await this.prisma.catOwnershipRecord.findMany({
      where: { catId },
      orderBy: { at: "asc" },
      select: {
        id: true,
        at: true,
        reason: true,
        fromUser: { select: { firstName: true } },
        toUser: { select: { firstName: true } },
      },
    });
    return {
      registeredAt: cat.createdAt,
      items: rows.map((r) => ({
        id: r.id,
        at: r.at,
        reason: r.reason,
        // First names only — provenance is a timeline, not a contact list.
        from: r.fromUser?.firstName ?? null,
        to: r.toUser?.firstName ?? null,
      })),
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Deciding
   * ────────────────────────────────────────────────────────────────────*/

  /** The outgoing owner changes their mind. Always allowed while pending. */
  async cancel(userId: string, transferId: string) {
    const transfer = await this.prisma.catOwnershipTransfer.findFirst({
      where: { id: transferId, fromUserId: userId },
      select: { id: true, status: true, catId: true, toUserId: true, cat: { select: { name: true } } },
    });
    if (!transfer) throw new NotFoundException("Transfer not found");
    if (transfer.status !== "PENDING") {
      throw new ConflictException({ code: "TRANSFER_NOT_PENDING", message: "This transfer is already settled." });
    }
    await this.prisma.catOwnershipTransfer.update({
      where: { id: transferId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (transfer.toUserId) {
      this.notifications.emit(transfer.toUserId, {
        category: "SYSTEM",
        type: "ownership_transfer_cancelled",
        params: { name: transfer.cat.name },
        data: { kind: "ownership_transfer", catId: transfer.catId },
      });
    }
    return { status: "CANCELLED" as const };
  }

  /** The recipient says no. The cat stays exactly where it is. */
  async decline(userId: string, userEmail: string, ref: string) {
    const transfer = await this.loadForRecipient(ref, userId, userEmail);
    await this.prisma.catOwnershipTransfer.update({
      where: { id: transfer.id },
      data: { status: "DECLINED", declinedAt: new Date(), toUserId: userId },
    });
    this.notifications.emit(transfer.fromUserId, {
      category: "SYSTEM",
      type: "ownership_transfer_declined",
      params: { name: transfer.cat.name },
      data: { kind: "ownership_transfer", catId: transfer.catId },
    });
    this.events.emit("ownership_transfer_declined", { userId, catId: transfer.catId });
    return { status: "DECLINED" as const };
  }

  /**
   * Accept — the one moment a Cat ID changes hands.
   *
   * Everything below happens in ONE transaction, and the transfer's state is
   * re-read inside it, so a double-tap or two tabs racing can only ever produce
   * one acceptance.
   */
  async accept(userId: string, userEmail: string, ref: string) {
    const pre = await this.loadForRecipient(ref, userId, userEmail);

    const result = await this.prisma.$transaction(async (tx) => {
      // Re-read under the transaction: the authoritative check.
      const t = await tx.catOwnershipTransfer.findUnique({
        where: { id: pre.id },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          catId: true,
          fromUserId: true,
          listingId: true,
          reason: true,
        },
      });
      if (!t || t.status !== "PENDING") {
        throw new ConflictException({
          code: "TRANSFER_NOT_PENDING",
          message: "This transfer has already been settled.",
        });
      }
      if (t.expiresAt.getTime() <= Date.now()) {
        throw new ConflictException({
          code: "TRANSFER_EXPIRED",
          message: "This transfer link has expired. Ask for a new one.",
        });
      }

      const cat = await tx.cat.findUnique({
        where: { id: t.catId },
        select: { id: true, name: true, userId: true, deletedAt: true, catIdNumber: true },
      });
      if (!cat || cat.deletedAt) {
        throw new NotFoundException({ code: "TRANSFER_CAT_GONE", message: "This cat's record is no longer available." });
      }
      // The cat must still be the sender's to give.
      if (cat.userId !== t.fromUserId) {
        throw new ConflictException({
          code: "TRANSFER_OWNER_CHANGED",
          message: "This cat has already moved to another member.",
        });
      }
      if (cat.userId === userId) {
        throw new ConflictException({ code: "TRANSFER_SELF", message: "This cat is already yours." });
      }

      // 1. The old owner's featured cat can't point at a cat they no longer
      //    hold — and `primaryCatId` is UNIQUE, so it must be cleared before
      //    the new owner can claim it.
      await tx.user.updateMany({ where: { primaryCatId: cat.id }, data: { primaryCatId: null } });

      // 2. Move the cat. The Cat ID number, census ordinal, QR token, photos,
      //    vaccinations, weights and clinical entries are all untouched — they
      //    hang off `catId`, which does not change. That is the whole promise.
      await tx.cat.update({
        where: { id: cat.id },
        data: {
          userId,
          // Per-field privacy encoded the PREVIOUS owner's consent. The cat
          // stays in the community if it was there, but the person behind it
          // changes, so anything that could reveal the new owner goes back to
          // the safe default until they choose otherwise (R106, principle #9).
          showOwnerName: false,
          showCity: false,
          shareConsentAt: null,
          // Lost mode belonged to the old household's emergency; a hand-over
          // is a planned move, not a disappearance.
          lostModeAt: null,
        },
      });

      // 3. Clinic access was granted by the previous owner. It does not follow
      //    the cat: the new owner decides who may open the record (R106).
      await tx.consentGrant.updateMany({
        where: { catId: cat.id, revokedAt: null },
        data: { revokedAt: new Date(), reason: "ownership_transferred" },
      });

      // 4. Emergency contacts are the old household's phone numbers.
      await tx.catEmergencyContact.deleteMany({ where: { catId: cat.id } });

      // 5. Provenance, appended forever.
      await tx.catOwnershipRecord.create({
        data: {
          catId: cat.id,
          fromUserId: t.fromUserId,
          toUserId: userId,
          reason: t.reason,
          transferId: t.id,
        },
      });

      // 6. Settle this offer, and withdraw every other one for this cat — the
      //    cat can only be given away once.
      await tx.catOwnershipTransfer.update({
        where: { id: t.id },
        data: { status: "ACCEPTED", acceptedAt: new Date(), toUserId: userId },
      });
      await tx.catOwnershipTransfer.updateMany({
        where: { catId: cat.id, status: "PENDING", id: { not: t.id } },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      // 7. If this came from an adoption listing, the adoption is complete.
      if (t.listingId) {
        await tx.adoptionListing.updateMany({
          where: { id: t.listingId, status: { in: ["AVAILABLE", "RESERVED"] } },
          data: { status: "ADOPTED", adoptedAt: new Date(), adoptedByUserId: userId },
        });
        await tx.adoptionRequest.updateMany({
          where: { listingId: t.listingId, requesterId: userId, status: "ACCEPTED" },
          data: { status: "COMPLETED", decidedAt: new Date() },
        });
        // Everyone else who asked deserves to know it went to someone.
        await tx.adoptionRequest.updateMany({
          where: { listingId: t.listingId, status: "PENDING" },
          data: { status: "DECLINED", decidedAt: new Date() },
        });
      }

      // 8. Any lost/found notice the old owner filed about this cat is closed —
      //    it is no longer their cat to be looking for.
      await tx.lostFoundPost.updateMany({
        where: { catId: cat.id, status: "ACTIVE" },
        data: { status: "CLOSED", closedAt: new Date() },
      });

      // 9. The new owner has a cat now — whatever brought them in.
      await tx.user.update({
        where: { id: userId },
        data: {
          noCatYetAt: null,
          // Give them a featured cat if they had none (multi-cat households
          // keep whichever face they already chose).
          primaryCat: { connect: { id: cat.id } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "cat.ownership.transferred",
          entityType: "Cat",
          entityId: cat.id,
          metadata: { transferId: t.id, fromUserId: t.fromUserId, toUserId: userId, reason: t.reason },
        },
      });

      return { cat, fromUserId: t.fromUserId, listingId: t.listingId, reason: t.reason };
    });

    // ── Outside the transaction: tell both people, warmly. ────────────────
    const [from, to] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: result.fromUserId },
        select: { email: true, firstName: true, locale: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, locale: true },
      }),
    ]);

    this.notifications.emit(result.fromUserId, {
      category: "SYSTEM",
      type: "ownership_transfer_completed_from",
      params: { name: result.cat.name, to: to?.firstName ?? "" },
      data: { kind: "ownership_transfer", catId: result.cat.id },
    });
    this.notifications.emit(userId, {
      category: "SYSTEM",
      type: "ownership_transfer_completed_to",
      params: { name: result.cat.name, id: result.cat.catIdNumber ?? "" },
      data: { kind: "ownership_transfer", catId: result.cat.id, url: `/portal/cats?cat=${result.cat.id}` },
    });

    for (const [person, role] of [
      [from, "from"],
      [to, "to"],
    ] as const) {
      if (!person?.email) continue;
      const tpl = ownershipTransferDoneTemplate(person.locale === "en" ? "en" : "ar", {
        role,
        catName: result.cat.name,
        catIdNumber: result.cat.catIdNumber,
        otherName: (role === "from" ? to?.firstName : from?.firstName) ?? null,
      });
      void this.mail
        .send({ to: person.email, subject: tpl.subject, html: tpl.html, text: tpl.text })
        .catch((err: Error) => this.logger.warn(`transfer-done mail failed: ${err.message}`));
    }

    this.events.emit("ownership_transfer_accepted", {
      userId,
      catId: result.cat.id,
      props: { reason: result.reason, fromListing: !!result.listingId },
    });
    if (result.listingId) {
      this.events.emit("adoption_completed", { userId, catId: result.cat.id });
    }

    return {
      status: "ACCEPTED" as const,
      catId: result.cat.id,
      catName: result.cat.name,
      catIdNumber: result.cat.catIdNumber,
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Internals
   * ────────────────────────────────────────────────────────────────────*/

  /**
   * Resolve a pending offer for the person trying to act on it.
   *
   * `ref` is EITHER the emailed token OR the transfer's own id. Both are
   * accepted because the email is not the only way a recipient meets an offer:
   * it also appears in their portal, and a member who deleted the email should
   * not be stuck watching a cat they were given sit out of reach. Neither form
   * is a capability on its own — the offer is addressed to an EMAIL, and
   * `assertRecipient` is what actually authorises, so a leaked link or a
   * guessed id cannot move a cat into a stranger's hands.
   */
  private async loadForRecipient(ref: string, userId: string, userEmail: string) {
    const transfer = await this.prisma.catOwnershipTransfer.findFirst({
      where: { OR: [{ tokenHash: hashToken(ref) }, { id: ref }] },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        toEmail: true,
        toUserId: true,
        tokenHash: true,
        catId: true,
        fromUserId: true,
        cat: { select: { name: true } },
      },
    });
    if (!transfer) {
      throw new NotFoundException({ code: "TRANSFER_NOT_FOUND", message: "This transfer link is not valid." });
    }
    if (transfer.status !== "PENDING") {
      throw new ConflictException({
        code: "TRANSFER_NOT_PENDING",
        message: "This transfer has already been settled.",
      });
    }
    if (transfer.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException({
        code: "TRANSFER_EXPIRED",
        message: "This transfer link has expired. Ask for a new one.",
      });
    }
    await this.assertRecipient(transfer, ref, userId, userEmail, "accept");
    return transfer;
  }

  /**
   * Is this signed-in person really who the offer was addressed to?
   *
   * Matching the account's email is necessary but not sufficient: anyone can
   * REGISTER an address they do not control, and an unverified account that
   * merely claims `toEmail` must never receive a cat and its medical record.
   * So the match has to be backed by proof of the inbox — either the emailed
   * token itself (only the inbox holds it) or a confirmed email on the account.
   */
  private async assertRecipient(
    transfer: { toEmail: string; toUserId: string | null; tokenHash: string },
    ref: string,
    userId: string,
    userEmail: string,
    verb: "see it" | "accept"
  ) {
    const addressedToMe =
      transfer.toUserId === userId || transfer.toEmail.toLowerCase() === userEmail.toLowerCase();
    if (!addressedToMe) {
      throw new ForbiddenException({
        code: "TRANSFER_WRONG_ACCOUNT",
        message: `This cat was offered to ${maskEmail(transfer.toEmail)}. Sign in with that account to ${verb}.`,
      });
    }
    const heldTheLink = transfer.tokenHash === hashToken(ref);
    if (heldTheLink) return;
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });
    if (!me?.emailVerified) {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Confirm your email first — or open the link we emailed you.",
      });
    }
  }

  private select() {
    return {
      id: true,
      status: true,
      toEmail: true,
      reason: true,
      note: true,
      createdAt: true,
      expiresAt: true,
      acceptedAt: true,
      listingId: true,
      fromUser: { select: { firstName: true } },
      cat: { select: { id: true, name: true, photoUrl: true, catIdNumber: true } },
    } satisfies Prisma.CatOwnershipTransferSelect;
  }

  private toCard(
    t: Prisma.CatOwnershipTransferGetPayload<{ select: ReturnType<OwnershipService["select"]> }>,
    direction: TransferDirection
  ) {
    return {
      id: t.id,
      direction,
      status: this.liveState(t.status, t.expiresAt),
      reason: t.reason,
      note: t.note,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      acceptedAt: t.acceptedAt,
      fromListing: !!t.listingId,
      fromName: t.fromUser.firstName,
      // The outgoing owner sees who they offered it to (they typed it);
      // masking it back to them would be theatre.
      toEmail: direction === "outgoing" ? t.toEmail : maskEmail(t.toEmail),
      cat: t.cat,
    };
  }

  /** PENDING + past its expiry reads as EXPIRED everywhere, without a cron. */
  private liveState(status: string, expiresAt: Date): string {
    return status === "PENDING" && expiresAt.getTime() <= Date.now() ? "EXPIRED" : status;
  }
}

/** `adopter@example.com` → `a••••r@example.com`. Recognisable, not disclosing. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  const head = local.slice(0, 1);
  const tail = local.length > 1 ? local.slice(-1) : "";
  return `${head}${"•".repeat(Math.max(2, Math.min(6, local.length - 2)))}${tail}@${domain}`;
}
