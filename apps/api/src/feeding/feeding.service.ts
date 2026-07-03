import { Injectable, NotFoundException } from "@nestjs/common";
import { calculateFeeding, type FeedingInput } from "@moraqat/core";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import type { FeedingCalcDto } from "./dto/feeding.dto";

@Injectable()
export class FeedingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stateless calculation — usable by guests and the marketing calculator. */
  calculate(dto: FeedingCalcDto) {
    return calculateFeeding(dto as FeedingInput);
  }

  /**
   * Compute for a saved cat (deriving inputs from its profile), then persist
   * the recommendation so it appears in the cat's history.
   */
  async calculateForCat(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, userId, deletedAt: null },
      include: { breed: true, healthConds: true },
    });
    if (!cat) throw new NotFoundException("Cat not found");

    const ageMonths = cat.birthDate ? monthsBetween(cat.birthDate, new Date()) : undefined;

    const input: FeedingInput = {
      weightKg: cat.weightKg ?? undefined,
      ageMonths,
      lifeStage: cat.lifeStage ?? undefined,
      activity: cat.activityLevel,
      isIndoor: cat.isIndoor,
      hasHealthConditions: cat.healthConds.length > 0,
      breedAvgWeightKg: cat.breed?.avgWeightKg ?? undefined,
    };

    const rec = calculateFeeding(input);

    const saved = await this.prisma.feedingRecommendation.create({
      data: {
        catId,
        dryFoodKgMonth: rec.dryFoodKgPerMonth,
        wetPouchesMonth: rec.wetPouchesPerMonth,
        treatsPacksMonth: rec.treatsPacksPerMonth,
        litterKgMonth: rec.litterKgPerMonth,
        supplementsMonth: rec.supplementsPerMonth,
        dailyCalories: rec.dailyCalories,
        estimatedCost: new Prisma.Decimal(rec.estimatedMonthlyCostSar),
        confidence: rec.confidence,
        rationale: { input, rationale: rec.rationale } as unknown as Prisma.InputJsonValue,
      },
    });

    return { id: saved.id, catId, ...rec };
  }

  async history(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!cat) throw new NotFoundException("Cat not found");

    return this.prisma.feedingRecommendation.findMany({
      where: { catId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
}

/** Whole months between two dates. */
function monthsBetween(from: Date, to: Date): number {
  return Math.max(
    0,
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  );
}
