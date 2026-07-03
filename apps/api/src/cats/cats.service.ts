import { Injectable, NotFoundException } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCatDto, UpdateCatDto } from "./dto/cat.dto";

const catInclude = {
  breed: true,
  healthConds: true,
  allergies: true,
} as const;

/**
 * Cat ID numbers are human-readable and unambiguous (R032) — something an owner
 * can read aloud with pride at a vet counter. Alphabet excludes 0/O/1/I/L.
 */
const ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateCatIdNumber(): string {
  const pick = (n: number) =>
    Array.from({ length: n }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join("");
  return `MRC-${pick(4)}-${pick(4)}`;
}

@Injectable()
export class CatsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCatDto) {
    return this.prisma.cat.create({
      data: {
        userId,
        // The Cat ID is issued at the moment the cat joins — instantly, so the
        // reveal ceremony (R031) has something real to celebrate.
        catIdNumber: await this.uniqueCatIdNumber(),
        idIssuedAt: new Date(),
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
    const cats = await this.prisma.cat.findMany({
      where: { userId, deletedAt: null },
      include: catInclude,
      orderBy: { createdAt: "asc" },
    });
    // Lazy issuance: no cat is ever left without an identity (pre-ID rows).
    for (const cat of cats) {
      if (!cat.catIdNumber) {
        const issued = await this.prisma.cat.update({
          where: { id: cat.id },
          data: { catIdNumber: await this.uniqueCatIdNumber(), idIssuedAt: new Date() },
        });
        cat.catIdNumber = issued.catIdNumber;
        cat.idIssuedAt = issued.idIssuedAt;
      }
    }
    return cats;
  }

  /** Generate a Cat ID number, retrying on the (rare) collision. */
  private async uniqueCatIdNumber(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const candidate = generateCatIdNumber();
      const clash = await this.prisma.cat.findUnique({
        where: { catIdNumber: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    // 31^8 space — five collisions in a row is effectively impossible.
    throw new Error("Could not allocate a unique Cat ID number");
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
