import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type { ChangePasswordDto, UpdateProfileDto } from "./dto/account.dto";

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

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
      locale: user.locale,
      status: user.status,
      primaryCatId: user.primaryCatId,
      phoneVerified: !!user.phoneVerified,
      twoFactorEnabled: user.twoFactor?.enabled ?? false,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({ where: { id: userId }, data: dto });
    return this.profile(userId);
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
    const [user, activeSub, ordersCount, wallet, loyalty, recentOrders, unreadNotifs, savings, cats] =
      await Promise.all([
        // The greeting is built from the owner's gender + their primary cat
        // (Recognition first, Principle 01). Both travel on the user record.
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, gender: true, primaryCatId: true },
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
          },
        }),
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

    return {
      // Everything the greeting needs, resolved server-side (يبو/أم {primary}).
      owner: { firstName: user?.firstName ?? null, gender: user?.gender ?? "UNSPECIFIED" },
      primaryCat: primaryCat
        ? {
            id: primaryCat.id,
            name: primaryCat.name,
            catIdNumber: primaryCat.catIdNumber,
            photoUrl: primaryCat.photoUrl,
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
}
