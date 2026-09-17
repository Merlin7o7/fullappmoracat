import { Injectable } from "@nestjs/common";
import { PLACEHOLDER_OWNER_EMAIL } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { IdsService } from "../ids/ids.service";

/**
 * The one system account that owns every clinic-created cat until its owner
 * claims it (MRC-PROD-001 T4, decision D2). `Cat.userId` stays non-null, so
 * every existing ownership check keeps working unchanged; the account itself
 * is SUSPENDED (cannot sign in) and holds no password.
 *
 * Every owner-facing send must skip this account — `is()` is the check.
 */
@Injectable()
export class PlaceholderOwnerService {
  private cachedId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService
  ) {}

  async id(): Promise<string> {
    if (this.cachedId) return this.cachedId;
    const existing = await this.prisma.user.findUnique({ where: { email: PLACEHOLDER_OWNER_EMAIL }, select: { id: true } });
    if (existing) return (this.cachedId = existing.id);
    const created = await this.prisma.user.create({
      data: {
        email: PLACEHOLDER_OWNER_EMAIL,
        memberIdNumber: await this.ids.newMemberId(),
        firstName: "Pending",
        lastName: "Claims",
        status: "SUSPENDED",
        locale: "ar",
      },
      select: { id: true },
    });
    return (this.cachedId = created.id);
  }

  async is(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;
    return userId === (await this.id());
  }
}
