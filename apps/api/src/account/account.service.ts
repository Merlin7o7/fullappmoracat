import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from "./dto/account.dto";

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { twoFactor: { select: { enabled: true } } },
    });
    if (!user) throw new NotFoundException("User not found");
    return {
      id: user.id,
      memberIdNumber: user.memberIdNumber,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      dialCode: user.dialCode,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      ownerNickname: user.ownerNickname,
      locale: user.locale,
      status: user.status,
      primaryCatId: user.primaryCatId,
      emailVerified: !!user.emailVerified,
      phoneVerified: !!user.phoneVerified,
      twoFactorEnabled: user.twoFactor?.enabled ?? false,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Explicit allow-list — never spread the DTO into Prisma. Even with the
    // global ValidationPipe whitelist, an accidental DTO field (or a pipe-config
    // regression) must never let a client set isStaff/status/etc. avatarUrl is
    // intentionally excluded here: it has its own validated upload path.
    const { firstName, lastName, phone, dialCode, gender, locale } = dto;
    await this.prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, phone, dialCode, gender, locale },
    });
    return this.profile(userId);
  }

  /** Upload + set the account avatar. Replaces (and deletes) the previous one. */
  async setAvatar(userId: string, file?: UploadedImage) {
    if (!file?.buffer?.length) throw new BadRequestException("No image provided");
    if (file.size > 8 * 1024 * 1024) throw new PayloadTooLargeException("Image must be 8 MB or smaller");
    // Byte-sniff the real type — never trust the client-declared mimetype (parity
    // with /uploads/image; blocks polyglot/SVG/HTML masquerading as an image).
    const ext = this.storage.sniffImageExt(file.buffer);
    if (!ext) throw new BadRequestException("Only real JPEG, PNG, or WebP images are allowed");
    const contentType = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";

    const prev = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    const key = this.storage.buildKey(`users/${userId}/avatar`, ext);
    const url = await this.storage.upload(key, file.buffer, contentType);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
    if (prev?.avatarUrl) void this.storage.remove(prev.avatarUrl);
    return { avatarUrl: url };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new BadRequestException("Password not set");
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException("Current password is incorrect");

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      // Security: revoke all sessions on password change.
      this.prisma.deviceSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
  }

  /** Dashboard aggregate — one call powers the portal overview. */
  async overview(userId: string) {
    const [
      user, activeSub, ordersCount, wallet, loyalty, recentOrders, unreadNotifs, savings, cats,
      vaccinationCount, vetVisitCount, photoCount,
    ] =
      await Promise.all([
        // The greeting is built from the owner's gender + their primary cat
        // (Recognition first, Principle 01). Both travel on the user record.
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, gender: true, primaryCatId: true, createdAt: true },
        }),
        this.prisma.subscription.findFirst({
          where: { userId, status: "ACTIVE" },
          orderBy: { nextDeliveryAt: "asc" },
          include: { plan: { select: { nameEn: true, nameAr: true, tier: true } } },
        }),
        this.prisma.order.count({ where: { userId } }),
        this.prisma.wallet.findUnique({ where: { userId } }),
        this.prisma.loyaltyAccount.findUnique({ where: { userId } }),
        this.prisma.order.findMany({
          where: { userId },
          orderBy: { placedAt: "desc" },
          take: 5,
          select: { orderNumber: true, status: true, grandTotal: true, placedAt: true },
        }),
        this.prisma.notification.count({ where: { userId, readAt: null } }),
        // Value made visible (R041): the cumulative member savings tally.
        this.prisma.order.aggregate({
          _sum: { discountTotal: true },
          where: { userId, status: { notIn: ["CANCELLED", "FAILED"] } },
        }),
        // The whole roster — the dashboard must stay clean at 1, 2, 5 or 20 cats,
        // so it needs the full (lightweight) list to render the cat rail + counts.
        this.prisma.cat.findMany({
          where: { userId, deletedAt: null },
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            catIdNumber: true,
            photoUrl: true,
            status: true,
            membershipStatus: true,
            likeCount: true,
          },
        }),
        // Beta value ledger (R048/R049): the non-monetary value the membership
        // actually holds — records kept, photos kept safe, love received.
        this.prisma.catVaccination.count({ where: { cat: { userId, deletedAt: null } } }),
        this.prisma.catVetVisit.count({ where: { cat: { userId, deletedAt: null } } }),
        this.prisma.catPhoto.count({ where: { cat: { userId, deletedAt: null } } }),
      ]);

    // Resolve the featured (primary) cat, self-healing to the first active one.
    let primaryId = user?.primaryCatId ?? null;
    const activeCats = cats.filter((c) => c.status === "ACTIVE");
    if (!activeCats.some((c) => c.id === primaryId)) {
      primaryId = activeCats[0]?.id ?? null;
    }
    const primaryCat = cats.find((c) => c.id === primaryId) ?? null;

    const counts = {
      total: cats.length,
      active: activeCats.length,
      archived: cats.filter((c) => c.status === "ARCHIVED").length,
      deceased: cats.filter((c) => c.status === "DECEASED").length,
    };

    // Profile completeness for the featured cat — gives the postponed-detail
    // strategy (R002/R017) a visible pull without a points scheme (§04).
    const completion = primaryId ? await this.catCompletion(primaryId) : null;

    return {
      // Everything the greeting needs, resolved server-side (يبو/أم {primary}).
      owner: { firstName: user?.firstName ?? null, gender: user?.gender ?? "UNSPECIFIED", memberSince: user?.createdAt ?? null },
      primaryCat: primaryCat
        ? {
            id: primaryCat.id,
            name: primaryCat.name,
            catIdNumber: primaryCat.catIdNumber,
            photoUrl: primaryCat.photoUrl,
            completion,
          }
        : null,
      cats: cats.map((c) => ({ ...c, isPrimary: c.id === primaryId })),
      activeSubscription: activeSub
        ? {
            id: activeSub.id,
            plan: activeSub.plan,
            status: activeSub.status,
            price: Number(activeSub.price),
            nextDeliveryAt: activeSub.nextDeliveryAt,
            nextBillingAt: activeSub.nextBillingAt,
          }
        : null,
      stats: {
        orders: ordersCount,
        cats: counts.active,
        catCounts: counts,
        walletBalance: wallet ? Number(wallet.balance) : 0,
        totalSaved: Number(savings._sum.discountTotal ?? 0),
        loyaltyPoints: loyalty?.points ?? 0,
        loyaltyTier: loyalty?.tier ?? "BRONZE",
        unreadNotifications: unreadNotifs,
        // The beta value ledger (R041/R048/R049) — proof of accrued care, not money.
        healthRecords: vaccinationCount + vetVisitCount,
        photos: photoCount,
        communityLikes: cats.reduce((sum, c) => sum + c.likeCount, 0),
      },
      // Back-compat alias for the previous overview shape.
      firstCat: primaryCat ? { name: primaryCat.name, catIdNumber: primaryCat.catIdNumber } : null,
      recentOrders: recentOrders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        grandTotal: Number(o.grandTotal),
        placedAt: o.placedAt,
      })),
    };
  }

  /** Percent-complete + the highest-value missing fields for a cat's file. */
  private async catCompletion(catId: string) {
    const cat = await this.prisma.cat.findUnique({
      where: { id: catId },
      select: {
        photoUrl: true, breedId: true, birthDate: true, weightKg: true, gender: true,
        coatColor: true, isNeutered: true, vaccinationStatus: true, bio: true,
      },
    });
    if (!cat) return null;
    const checklist: { key: string; done: boolean }[] = [
      { key: "photo", done: !!cat.photoUrl },
      { key: "breed", done: !!cat.breedId },
      { key: "birthDate", done: !!cat.birthDate },
      { key: "weight", done: cat.weightKg != null },
      { key: "gender", done: cat.gender !== "UNKNOWN" },
      { key: "coatColor", done: !!cat.coatColor },
      { key: "neutered", done: cat.isNeutered != null },
      { key: "vaccination", done: !!cat.vaccinationStatus },
      { key: "bio", done: !!cat.bio },
    ];
    const done = checklist.filter((c) => c.done).length;
    return {
      percent: Math.round((done / checklist.length) * 100),
      done,
      total: checklist.length,
      missing: checklist.filter((c) => !c.done).map((c) => c.key),
    };
  }

  async wallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 25 } },
    });
    if (!wallet) return { balance: 0, currency: "SAR", transactions: [] };
    return {
      balance: Number(wallet.balance),
      currency: wallet.currency,
      transactions: wallet.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  }

  async loyalty(userId: string) {
    const acc = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: "desc" }, take: 25 } },
    });
    if (!acc) return { points: 0, tier: "BRONZE", transactions: [] };
    return {
      points: acc.points,
      tier: acc.tier,
      transactions: acc.transactions,
    };
  }

  async activity(userId: string) {
    const [logins, sessions] = await Promise.all([
      this.prisma.loginHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.deviceSession.findMany({
        where: { userId, revokedAt: null },
        orderBy: { lastActiveAt: "desc" },
        select: { id: true, userAgent: true, ipAddress: true, lastActiveAt: true, createdAt: true },
      }),
    ]);
    return { logins, sessions };
  }

  async notifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  }

  async markNotificationRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  // ── Referral loop (invite with recognition, not coupons — §High) ──────────

  /** My shareable referral code + how many members I've brought in. Lazily mints
   *  a code on first view so we never generate one we won't use. */
  async referral(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { referralCode: true } });
    if (!user) throw new NotFoundException("User not found");
    let code = user.referralCode;
    if (!code) {
      code = await this.mintReferralCode();
      await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
    }
    const invited = await this.prisma.user.count({ where: { referredByCode: code, deletedAt: null } });
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
    return { code, invited, link: `${base}/register?ref=${code}` };
  }

  private async mintReferralCode(): Promise<string> {
    // Unambiguous base32 (no 0/O/1/I), 7 chars — collision-checked.
    const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    for (let attempt = 0; attempt < 6; attempt++) {
      const bytes = randomBytes(7);
      const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
      const clash = await this.prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
      if (!clash) return code;
    }
    // Astronomically unlikely — fall back to a longer code.
    return randomBytes(12).toString("hex");
  }

  // ── Notification preferences (curated categories; prayer-aware later, R107) ─

  private static readonly PREF_CATEGORIES = ["COMMUNITY", "PROMOTION", "SYSTEM"] as const;

  async notificationPreferences(userId: string) {
    const rows = await this.prisma.notificationPreference.findMany({
      where: { userId, channel: "EMAIL", category: { in: [...AccountService.PREF_CATEGORIES] } },
      select: { category: true, enabled: true },
    });
    const byCat = new Map(rows.map((r) => [r.category, r.enabled]));
    // Absent = default ON (opt-out model), except PROMOTION which defaults OFF.
    return AccountService.PREF_CATEGORIES.map((category) => ({
      category,
      enabled: byCat.get(category) ?? category !== "PROMOTION",
    }));
  }

  async setNotificationPreference(userId: string, category: string, enabled: boolean) {
    if (!AccountService.PREF_CATEGORIES.includes(category as (typeof AccountService.PREF_CATEGORIES)[number])) {
      throw new BadRequestException("Unknown notification category");
    }
    await this.prisma.notificationPreference.upsert({
      where: { userId_channel_category: { userId, channel: "EMAIL", category: category as never } },
      update: { enabled },
      create: { userId, channel: "EMAIL", category: category as never, enabled },
    });
    return { category, enabled };
  }

  // ── PDPL: data portability + erasure (R010 "leaving is easy", R106) ────────

  /**
   * Machine-readable export of everything we hold about the member — the PDPL
   * right of access. Secrets (password/2FA/token hashes) are never included.
   */
  async exportMyData(userId: string) {
    const [user, cats, addresses, orders, subscriptions, notifications, wallet, loyalty, likes] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          include: { twoFactor: { select: { enabled: true, verifiedAt: true } } },
        }),
        this.prisma.cat.findMany({
          where: { userId },
          include: { vaccinations: true, vetVisits: true, documents: true, photos: true },
        }),
        this.prisma.address.findMany({ where: { userId } }),
        this.prisma.order.findMany({ where: { userId } }),
        this.prisma.subscription.findMany({ where: { userId } }),
        this.prisma.notification.findMany({ where: { userId } }),
        this.prisma.wallet.findUnique({ where: { userId }, include: { transactions: true } }),
        this.prisma.loyaltyAccount.findUnique({ where: { userId }, include: { transactions: true } }),
        this.prisma.catLike.findMany({ where: { userId }, select: { catId: true, createdAt: true } }),
      ]);
    if (!user) throw new NotFoundException("User not found");

    // Strip internal secrets from the account record.
    const { passwordHash: _p, ...account } = user as typeof user & { passwordHash?: string };
    void _p;

    return {
      exportedAt: new Date().toISOString(),
      account,
      cats,
      addresses,
      orders,
      subscriptions,
      notifications,
      wallet,
      loyalty,
      likes,
    };
  }

  /**
   * Erase the account (PDPL right to erasure). Anonymize-in-place rather than
   * hard-delete: Order.userId is FK-Restrict (accounting must retain de-identified
   * order rows), so we tombstone the PII, unpublish + soft-delete the cats, revoke
   * every session, and drop 2FA/OAuth. Re-authenticated first: password for
   * password accounts, an explicit confirm for password-less (Google) ones.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, passwordHash: true, avatarUrl: true },
    });
    if (!user) throw new NotFoundException("User not found");

    if (user.passwordHash) {
      const ok = dto.password ? await bcrypt.compare(dto.password, user.passwordHash) : false;
      if (!ok) throw new UnauthorizedException("Password is incorrect");
    } else if (dto.confirm !== true) {
      throw new BadRequestException("Please confirm account deletion");
    }

    const tombstone = `deleted+${user.id}@deleted.moracat.invalid`;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          status: "DEACTIVATED",
          email: tombstone,
          phone: null,
          firstName: null,
          lastName: null,
          ownerNickname: null,
          avatarUrl: null,
          passwordHash: null,
          primaryCatId: null,
        },
      }),
      // Unpublish + soft-delete the member's cats (removes them from community).
      this.prisma.cat.updateMany({
        where: { userId },
        data: { isPublic: false, deletedAt: new Date() },
      }),
      // Revoke every active session → immediate sign-out everywhere.
      this.prisma.deviceSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.twoFactor.deleteMany({ where: { userId } }),
      this.prisma.oAuthAccount.deleteMany({ where: { userId } }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: "account.delete",
          entityType: "User",
          entityId: userId,
          metadata: { reason: dto.reason ?? null },
        },
      }),
    ]);

    // Best-effort removal of the stored avatar object.
    if (user.avatarUrl) void this.storage.remove(user.avatarUrl);
    return { deleted: true };
  }
}
