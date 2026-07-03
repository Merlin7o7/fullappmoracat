import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateCatDto,
  ListCatsQueryDto,
  UpdateCatDto,
} from "./dto/cat.dto";
import type {
  CreateDocumentDto,
  CreateVaccinationDto,
  CreateVetVisitDto,
} from "./dto/cat-health.dto";

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

type CatRow = {
  id: string;
  name: string;
  catIdNumber: string | null;
  idIssuedAt: Date | null;
  photoUrl: string | null;
  gender: string;
  birthDate: Date | null;
  weightKg: number | null;
  lifeStage: string | null;
  activityLevel: string;
  isIndoor: boolean;
  status: string;
  membershipStatus: string;
  archivedAt: Date | null;
  deceasedAt: Date | null;
  microchipNo: string | null;
  diet: string | null;
  vetNotes: string | null;
  favoriteFoods: string[];
  preferredBrand: string[];
  createdAt: Date;
  breed?: { nameEn: string; nameAr: string } | null;
  healthConds?: { id: string; name: string; notes: string | null }[];
  allergies?: { id: string; allergen: string }[];
};

@Injectable()
export class CatsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCatDto) {
    const cat = await this.prisma.cat.create({
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

    // The first cat a household adds becomes the Primary Cat automatically —
    // the featured identity + greeting subject (multi-cat requirement). No extra
    // step for single-cat owners (R005 one clear action).
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCatId: true },
    });
    if (!user?.primaryCatId) {
      await this.prisma.user.update({ where: { id: userId }, data: { primaryCatId: cat.id } });
    }

    return this.serialize(cat as CatRow, user?.primaryCatId ?? cat.id);
  }

  async findAll(userId: string, query: ListCatsQueryDto = {}) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCatId: true },
    });

    const search = query.search?.trim();
    const cats = await this.prisma.cat.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(query.status ? { status: query.status as never } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { catIdNumber: { contains: search.toUpperCase() } },
              ],
            }
          : {}),
      },
      include: catInclude,
      // Active first, then most-recently-added — a stable, scannable order that
      // stays clean whether the household has 1 cat or 20.
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
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

    // Self-heal: if the stored primary is gone/archived/deceased, promote the
    // first active cat so the household always has a valid featured identity.
    let primaryId = user?.primaryCatId ?? null;
    const primaryValid = cats.some((c) => c.id === primaryId && c.status === "ACTIVE");
    if (!primaryValid) {
      const nextPrimary = cats.find((c) => c.status === "ACTIVE") ?? null;
      primaryId = nextPrimary?.id ?? null;
      if (primaryId !== (user?.primaryCatId ?? null)) {
        await this.prisma.user.update({ where: { id: userId }, data: { primaryCatId: primaryId } });
      }
    }

    return cats.map((c) => this.serialize(c as CatRow, primaryId));
  }

  async findOne(userId: string, id: string) {
    const [cat, user] = await Promise.all([
      this.prisma.cat.findFirst({
        where: { id, userId, deletedAt: null },
        include: {
          ...catInclude,
          vaccinations: { orderBy: { administeredAt: "desc" } },
          vetVisits: { orderBy: { visitedAt: "desc" } },
          documents: { orderBy: { createdAt: "desc" } },
        },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { primaryCatId: true } }),
    ]);
    if (!cat) throw new NotFoundException("Cat not found");
    return {
      ...this.serialize(cat as CatRow, user?.primaryCatId ?? null),
      vaccinations: cat.vaccinations,
      vetVisits: cat.vetVisits.map((v) => ({ ...v, cost: v.cost ? Number(v.cost) : null })),
      documents: cat.documents,
    };
  }

  async update(userId: string, id: string, dto: UpdateCatDto) {
    await this.ownedCat(userId, id);

    if (dto.allergies) {
      await this.prisma.catAllergy.deleteMany({ where: { catId: id } });
    }
    if (dto.healthConditions) {
      await this.prisma.catHealthCondition.deleteMany({ where: { catId: id } });
    }

    const cat = await this.prisma.cat.update({
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCatId: true },
    });
    return this.serialize(cat as CatRow, user?.primaryCatId ?? null);
  }

  // ── Primary cat ───────────────────────────────────────────────────────────
  /** Choose which cat is the household's featured identity + greeting subject. */
  async setPrimary(userId: string, id: string) {
    const cat = await this.ownedCat(userId, id);
    if (cat.status !== "ACTIVE") {
      throw new BadRequestException("Only an active cat can be the primary cat");
    }
    await this.prisma.user.update({ where: { id: userId }, data: { primaryCatId: id } });
    return { success: true, primaryCatId: id };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  async archive(userId: string, id: string) {
    await this.ownedCat(userId, id);
    await this.prisma.cat.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date(), membershipStatus: "INACTIVE" },
    });
    await this.reassignPrimaryIfNeeded(userId, id);
    return { success: true };
  }

  /** Archive a passing with dignity — record + Cat ID are kept forever (P09). */
  async markDeceased(userId: string, id: string, deceasedAt?: string) {
    await this.ownedCat(userId, id);
    await this.prisma.cat.update({
      where: { id },
      data: {
        status: "DECEASED",
        deceasedAt: deceasedAt ? new Date(deceasedAt) : new Date(),
        membershipStatus: "INACTIVE",
      },
    });
    await this.reassignPrimaryIfNeeded(userId, id);
    return { success: true };
  }

  async restore(userId: string, id: string) {
    await this.ownedCat(userId, id);
    const cat = await this.prisma.cat.update({
      where: { id },
      data: { status: "ACTIVE", archivedAt: null, deceasedAt: null, membershipStatus: "ACTIVE" },
      include: catInclude,
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCatId: true },
    });
    // If the household had no valid primary, this restored cat becomes it.
    if (!user?.primaryCatId) {
      await this.prisma.user.update({ where: { id: userId }, data: { primaryCatId: id } });
    }
    return this.serialize(cat as CatRow, user?.primaryCatId ?? id);
  }

  async remove(userId: string, id: string) {
    await this.ownedCat(userId, id);
    await this.prisma.cat.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.reassignPrimaryIfNeeded(userId, id);
    return { success: true };
  }

  // ── Health record: vaccinations ─────────────────────────────────────────────
  async addVaccination(userId: string, catId: string, dto: CreateVaccinationDto) {
    await this.ownedCat(userId, catId);
    return this.prisma.catVaccination.create({
      data: {
        catId,
        name: dto.name,
        administeredAt: new Date(dto.administeredAt),
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        vetName: dto.vetName,
        clinic: dto.clinic,
        batchNo: dto.batchNo,
        notes: dto.notes,
      },
    });
  }

  async listVaccinations(userId: string, catId: string) {
    await this.ownedCat(userId, catId);
    return this.prisma.catVaccination.findMany({
      where: { catId },
      orderBy: { administeredAt: "desc" },
    });
  }

  async removeVaccination(userId: string, catId: string, id: string) {
    await this.ownedCat(userId, catId);
    await this.prisma.catVaccination.deleteMany({ where: { id, catId } });
    return { success: true };
  }

  // ── Health record: vet visits ───────────────────────────────────────────────
  async addVetVisit(userId: string, catId: string, dto: CreateVetVisitDto) {
    await this.ownedCat(userId, catId);
    const visit = await this.prisma.catVetVisit.create({
      data: {
        catId,
        visitedAt: new Date(dto.visitedAt),
        reason: dto.reason,
        clinic: dto.clinic,
        vetName: dto.vetName,
        diagnosis: dto.diagnosis,
        notes: dto.notes,
        weightKg: dto.weightKg,
        cost: dto.cost,
      },
    });
    return { ...visit, cost: visit.cost ? Number(visit.cost) : null };
  }

  async listVetVisits(userId: string, catId: string) {
    await this.ownedCat(userId, catId);
    const visits = await this.prisma.catVetVisit.findMany({
      where: { catId },
      orderBy: { visitedAt: "desc" },
    });
    return visits.map((v) => ({ ...v, cost: v.cost ? Number(v.cost) : null }));
  }

  // ── Health record: documents ────────────────────────────────────────────────
  async addDocument(userId: string, catId: string, dto: CreateDocumentDto) {
    await this.ownedCat(userId, catId);
    return this.prisma.catDocument.create({
      data: { catId, title: dto.title, kind: dto.kind, url: dto.url, notes: dto.notes },
    });
  }

  async listDocuments(userId: string, catId: string) {
    await this.ownedCat(userId, catId);
    return this.prisma.catDocument.findMany({ where: { catId }, orderBy: { createdAt: "desc" } });
  }

  async removeDocument(userId: string, catId: string, id: string) {
    await this.ownedCat(userId, catId);
    await this.prisma.catDocument.deleteMany({ where: { id, catId } });
    return { success: true };
  }

  // ── Internals ────────────────────────────────────────────────────────────────
  private async ownedCat(userId: string, id: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!cat) throw new NotFoundException("Cat not found");
    return cat;
  }

  /** When the primary cat leaves (archived/deceased/removed), promote another. */
  private async reassignPrimaryIfNeeded(userId: string, leavingCatId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCatId: true },
    });
    if (user?.primaryCatId !== leavingCatId) return;

    const next = await this.prisma.cat.findFirst({
      where: { userId, deletedAt: null, status: "ACTIVE", id: { not: leavingCatId } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { primaryCatId: next?.id ?? null },
    });
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

  private serialize(cat: CatRow, primaryCatId: string | null) {
    return {
      id: cat.id,
      name: cat.name,
      catIdNumber: cat.catIdNumber,
      idIssuedAt: cat.idIssuedAt,
      photoUrl: cat.photoUrl,
      gender: cat.gender,
      birthDate: cat.birthDate,
      weightKg: cat.weightKg,
      lifeStage: cat.lifeStage,
      activityLevel: cat.activityLevel,
      isIndoor: cat.isIndoor,
      status: cat.status,
      membershipStatus: cat.membershipStatus,
      archivedAt: cat.archivedAt,
      deceasedAt: cat.deceasedAt,
      microchipNo: cat.microchipNo,
      diet: cat.diet,
      vetNotes: cat.vetNotes,
      favoriteFoods: cat.favoriteFoods,
      preferredBrand: cat.preferredBrand,
      isPrimary: cat.id === primaryCatId,
      breed: cat.breed ?? null,
      healthConds: cat.healthConds ?? [],
      allergies: cat.allergies ?? [],
    };
  }
}
