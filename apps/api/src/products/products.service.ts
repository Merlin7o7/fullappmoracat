import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import type { QueryProductsDto } from "./dto/query-products.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(q: QueryProductsDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 12;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
      ...(q.type ? { type: q.type } : {}),
      ...(q.brand ? { brand: { slug: q.brand } } : {}),
      ...(q.search
        ? {
            OR: [
              { nameEn: { contains: q.search, mode: "insensitive" } },
              { nameAr: { contains: q.search } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      q.sort === "price_asc" ? { price: "asc" }
      : q.sort === "price_desc" ? { price: "desc" }
      : q.sort === "rating" ? { ratingAvg: "desc" }
      : { createdAt: "desc" };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          brand: { select: { slug: true, nameEn: true, nameAr: true } },
          images: { where: { isPrimary: true }, take: 1 },
        },
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
        compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
        currency: p.currency,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        brand: p.brand,
        image: p.images[0]?.url ?? null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  async findBySlug(slug: string) {
    const p = await this.prisma.product.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      include: {
        brand: true,
        images: { orderBy: { sortOrder: "asc" } },
        videos: true,
        categories: { include: { category: true } },
        nutrition: { orderBy: { sortOrder: "asc" } },
        ingredients: { include: { ingredient: true }, orderBy: { sortOrder: "asc" } },
        variants: true,
        reviews: {
          where: { isApproved: true },
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { firstName: true } } },
        },
      },
    });
    if (!p) throw new NotFoundException("Product not found");

    return {
      ...p,
      price: Number(p.price),
      compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
      costPrice: undefined, // never expose cost to the storefront
      categories: p.categories.map((c) => c.category),
      ingredients: p.ingredients.map((i) => i.ingredient),
    };
  }
}
