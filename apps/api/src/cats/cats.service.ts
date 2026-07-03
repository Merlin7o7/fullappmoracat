import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCatDto, UpdateCatDto } from "./dto/cat.dto";

const catInclude = {
  breed: true,
  healthConds: true,
  allergies: true,
} as const;

@Injectable()
export class CatsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCatDto) {
    return this.prisma.cat.create({
      data: {
        userId,
        name: dto.name,
        photoUrl: dto.photoUrl,
        breedId: dto.breedId,
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        weightKg: dto.weightKg,
        lifeStage: dto.lifeStage,
        activityLevel: dto.activityLevel ?? "MODERATE",
        isIndoor: dto.isIndoor ?? true,
        diet: dto.diet,
        vetNotes: dto.vetNotes,
        microchipNo: dto.microchipNo,
        favoriteFoods: dto.favoriteFoods ?? [],
        preferredBrand: dto.preferredBrand ?? [],
        allergies: dto.allergies?.length
          ? { create: dto.allergies.map((allergen) => ({ allergen })) }
          : undefined,
        healthConds: dto.healthConditions?.length
          ? { create: dto.healthConditions.map((name) => ({ name })) }
          : undefined,
      },
      include: catInclude,
    });
  }

  async findAll(userId: string) {
    return this.prisma.cat.findMany({
      where: { userId, deletedAt: null },
      include: catInclude,
      orderBy: { createdAt: "asc" },
    });
  }

  async findOne(userId: string, id: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id, userId, deletedAt: null },
      include: catInclude,
    });
    if (!cat) throw new NotFoundException("Cat not found");
    return cat;
  }

  async update(userId: string, id: string, dto: UpdateCatDto) {
    await this.findOne(userId, id); // ownership guard

    // Replace nested collections when provided.
    if (dto.allergies) {
      await this.prisma.catAllergy.deleteMany({ where: { catId: id } });
    }
    if (dto.healthConditions) {
      await this.prisma.catHealthCondition.deleteMany({ where: { catId: id } });
    }

    return this.prisma.cat.update({
      where: { id },
      data: {
        name: dto.name,
        photoUrl: dto.photoUrl,
        breedId: dto.breedId,
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        weightKg: dto.weightKg,
        lifeStage: dto.lifeStage,
        activityLevel: dto.activityLevel,
        isIndoor: dto.isIndoor,
        diet: dto.diet,
        vetNotes: dto.vetNotes,
        microchipNo: dto.microchipNo,
        favoriteFoods: dto.favoriteFoods,
        preferredBrand: dto.preferredBrand,
        allergies: dto.allergies?.length
          ? { create: dto.allergies.map((allergen) => ({ allergen })) }
          : undefined,
        healthConds: dto.healthConditions?.length
          ? { create: dto.healthConditions.map((name) => ({ name })) }
          : undefined,
      },
      include: catInclude,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.cat.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }
}
