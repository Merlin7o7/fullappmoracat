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
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      status: user.status,
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
    const [activeSub, ordersCount, catsCount, wallet, loyalty, recentOrders, unreadNotifs] =
      await Promise.all([
        this.prisma.subscription.findFirst({
          where: { userId, status: "ACTIVE" },
          orderBy: { nextDeliveryAt: "asc" },
          include: { plan: { select: { nameEn: true, nameAr: true, tier: true } } },
        }),
        this.prisma.order.count({ where: { userId } }),
        this.prisma.cat.count({ where: { userId, deletedAt: null } }),
        this.prisma.wallet.findUnique({ where: { userId } }),
        this.prisma.loyaltyAccount.findUnique({ where: { userId } }),
        this.prisma.order.findMany({
          where: { userId },
          orderBy: { placedAt: "desc" },
          take: 5,
          select: { orderNumber: true, status: true, grandTotal: true, placedAt: true },
        }),
        this.prisma.notification.count({ where: { userId, readAt: null } }),
      ]);

    return {
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
        cats: catsCount,
        walletBalance: wallet ? Number(wallet.balance) : 0,
        loyaltyPoints: loyalty?.points ?? 0,
        loyaltyTier: loyalty?.tier ?? "BRONZE",
        unreadNotifications: unreadNotifs,
      },
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
