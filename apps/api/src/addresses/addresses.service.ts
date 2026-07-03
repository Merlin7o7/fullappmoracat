import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      include: { city: { select: { nameEn: true, nameAr: true } } },
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    const city = await this.prisma.city.findFirst({ where: { id: dto.cityId, isActive: true } });
    if (!city) throw new BadRequestException("We don't deliver to that city yet");

    const count = await this.prisma.address.count({ where: { userId } });
    const makeDefault = dto.isDefault || count === 0;

    if (makeDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.create({
      data: { ...dto, userId, isDefault: makeDefault },
      include: { city: { select: { nameEn: true, nameAr: true } } },
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    await this.owned(userId, id);
    if (dto.isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.update({
      where: { id },
      data: dto,
      include: { city: { select: { nameEn: true, nameAr: true } } },
    });
  }

  async remove(userId: string, id: string) {
    const addr = await this.owned(userId, id);
    await this.prisma.address.delete({ where: { id } });
    // If we removed the default, promote the most recent remaining address.
    if (addr.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
    return { success: true };
  }

  private async owned(userId: string, id: string) {
    const addr = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!addr) throw new NotFoundException("Address not found");
    return addr;
  }
}
