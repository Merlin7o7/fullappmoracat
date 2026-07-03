import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateProductDto, UpdateProductDto } from "./admin-products.dto";

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, search?: string) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(search
        ? { OR: [{ nameEn: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { brand: { select: { nameEn: true } }, inventoryItems: { select: { quantity: true } } },
      }),
    ]);
    return {
      items: rows.map((p) => ({
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        type: p.type,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        price: Number(p.price),
        costPrice: p.costPrice ? Number(p.costPrice) : null,
        brand: p.brand?.nameEn ?? null,
        isActive: p.isActive,
        stock: p.inventoryItems.reduce((s, i) => s + i.quantity, 0),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(dto: CreateProductDto) {
    const clash = await this.prisma.product.findFirst({
      where: { OR: [{ slug: dto.slug }, { sku: dto.sku }] },
    });
    if (clash) throw new BadRequestException("A product with that slug or SKU already exists");
    return this.prisma.product.create({
      data: {
        slug: dto.slug, sku: dto.sku, type: dto.type, nameEn: dto.nameEn, nameAr: dto.nameAr,
        descriptionEn: dto.descriptionEn, descriptionAr: dto.descriptionAr,
        price: new Prisma.Decimal(dto.price),
        costPrice: dto.costPrice != null ? new Prisma.Decimal(dto.costPrice) : null,
        brandId: dto.brandId, isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.owned(id);
    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        price: dto.price != null ? new Prisma.Decimal(dto.price) : undefined,
        costPrice: dto.costPrice != null ? new Prisma.Decimal(dto.costPrice) : undefined,
      },
    });
  }

  async toggleActive(id: string) {
    const p = await this.owned(id);
    return this.prisma.product.update({ where: { id }, data: { isActive: !p.isActive } });
  }

  private async owned(id: string) {
    const p = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!p) throw new NotFoundException("Product not found");
    return p;
  }
}
