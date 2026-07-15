import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** All active plans with their box contents, ordered for display. */
  async findAll() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { contents: { orderBy: { label: "asc" } } },
    });

    // Serialise Decimals to numbers for a clean JSON contract.
    return plans.map((p) => ({
      id: p.id,
      tier: p.tier,
      slug: p.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      descriptionEn: p.descriptionEn,
      descriptionAr: p.descriptionAr,
      price: Number(p.basePrice), // monthly price
      minTermMonths: p.minTermMonths,
      // cogs is an internal margin figure — never serialised to the public plans
      // endpoint. Exposing it lets anyone compute our per-box margin (R006).
      currency: p.currency,
      contents: p.contents.map((c) => ({
        label: c.label,
        quantity: c.quantity,
        unit: c.unit,
      })),
    }));
  }
}
