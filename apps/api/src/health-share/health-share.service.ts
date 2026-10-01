import { GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { ageInMonths } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { CatsService } from "../cats/cats.service";

const DAY = 86_400_000;
const ALLOWED_DAYS = [1, 7, 30, 90] as const;
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/**
 * The shareable vet health summary (W6): one link an owner sends a vet, and
 * the vet sees a clean medical summary — no account, no app, no tour.
 *
 * Security model:
 *   - 256-bit token, only its SHA-256 stored; the URL is returned once.
 *   - Expires (1 / 7 / 30 / 90 days), revocable any time, and dies the moment
 *     the cat is handed to a new owner (the issuer no longer owns the record).
 *   - The summary is the OWNER's projection of the record (cats.getHealth) —
 *     the same facts the owner already sees — never vet-internal notes.
 *   - Documents open through 5-minute signed links minted at view time.
 *   - The owner's phone appears only if they ticked "include my number".
 *   - Every view is counted and time-stamped on the owner's link list.
 */
@Injectable()
export class HealthShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cats: CatsService
  ) {}

  private async ownedCat(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({ where: { id: catId, userId, deletedAt: null }, select: { id: true } });
    if (!cat) throw new NotFoundException("Cat not found");
  }

  async create(userId: string, catId: string, dto: { days?: number; includeContact?: boolean }) {
    await this.ownedCat(userId, catId);
    const days = (ALLOWED_DAYS as readonly number[]).includes(dto.days ?? 7) ? (dto.days ?? 7) : 7;
    const token = randomBytes(32).toString("base64url");
    const link = await this.prisma.healthShareLink.create({
      data: {
        catId,
        createdById: userId,
        tokenHash: hashToken(token),
        includeContact: !!dto.includeContact,
        expiresAt: new Date(Date.now() + days * DAY),
      },
      select: { id: true, expiresAt: true, includeContact: true, createdAt: true },
    });
    return { ...link, url: `${siteUrl()}/h/${token}` };
  }

  async list(userId: string, catId: string) {
    await this.ownedCat(userId, catId);
    const links = await this.prisma.healthShareLink.findMany({
      where: { catId, createdById: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, expiresAt: true, revokedAt: true, includeContact: true, viewCount: true, lastViewedAt: true, createdAt: true },
    });
    const now = Date.now();
    return links.map((l) => ({ ...l, active: !l.revokedAt && l.expiresAt.getTime() > now }));
  }

  async revoke(userId: string, catId: string, linkId: string) {
    await this.ownedCat(userId, catId);
    const res = await this.prisma.healthShareLink.updateMany({
      where: { id: linkId, catId, createdById: userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!res.count) throw new NotFoundException("Link not found");
    return { success: true };
  }

  /** The public read. Gone (410) for expired / revoked / handed-on; 404 for unknown. */
  async view(token: string) {
    if (!token || token.length > 100) throw new NotFoundException();
    const link = await this.prisma.healthShareLink.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true, catId: true, createdById: true, includeContact: true, expiresAt: true, revokedAt: true, createdAt: true,
        cat: {
          select: {
            userId: true, deletedAt: true, name: true, photoUrl: true, catIdNumber: true, gender: true, birthDate: true,
            isNeutered: true, coatColor: true, weightKg: true,
            breed: { select: { nameAr: true, nameEn: true } },
            user: { select: { firstName: true, phone: true } },
            documents: { orderBy: { createdAt: "desc" }, take: 20 },
          },
        },
      },
    });
    if (!link) throw new NotFoundException();
    const ownerChanged = link.cat.userId !== link.createdById || !!link.cat.deletedAt;
    if (link.revokedAt || link.expiresAt.getTime() <= Date.now() || ownerChanged) {
      throw new GoneException({ code: "HEALTH_LINK_GONE", message: "This health summary link is no longer active." });
    }

    const record = await this.cats.getHealth(link.createdById, link.catId);
    await this.prisma.healthShareLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });

    const c = link.cat;
    const times = [
      ...record.vaccination.records.map((v) => v.administeredAt),
      ...record.weights.map((w) => w.measuredAt),
      ...record.clinicalEntries.map((e) => e.occurredAt),
      ...record.visits.map((v) => v.checkedInAt),
    ].map((d) => new Date(d).getTime());

    return {
      issuedAt: link.createdAt,
      expiresAt: link.expiresAt,
      lastUpdatedAt: times.length ? new Date(Math.max(...times)) : null,
      cat: {
        name: c.name,
        photoUrl: c.photoUrl,
        catIdNumber: c.catIdNumber,
        breed: c.breed ? { ar: c.breed.nameAr, en: c.breed.nameEn } : null,
        sex: c.gender,
        birthDate: c.birthDate,
        ageMonths: ageInMonths(c.birthDate ? c.birthDate.toISOString() : null),
        neutered: c.isNeutered,
        coatColor: c.coatColor,
        weightKg: c.weightKg,
        microchipNo: record.cat.microchipNo,
      },
      owner: {
        firstName: c.user.firstName,
        phone: link.includeContact ? c.user.phone : null,
      },
      safety: {
        allergies: record.cat.allergies,
        conditions: record.cat.healthConditions,
        medications: record.cat.currentMedications,
        food: record.cat.currentFood,
        emergencyNotes: record.cat.emergencyNotes,
      },
      vaccination: record.vaccination,
      weights: record.weights,
      // Current medication only: what a treating vet must know today.
      prescriptions: record.prescriptions.filter((p) => ["ISSUED", "COLLECTED", "REFILLED"].includes(p.status)),
      clinicalEntries: record.clinicalEntries.slice(0, 15).map((e) => ({ id: e.id, type: e.type, occurredAt: e.occurredAt, clinic: e.clinic, title: e.title, summary: e.summary })),
      visits: record.visits.slice(0, 10).map((v) => ({ id: v.id, checkedInAt: v.checkedInAt, reason: v.reason, clinic: v.clinic })),
      documents: c.documents.map((d) => {
        const v = this.cats.documentView(d);
        return { id: d.id, title: d.title, kind: d.kind, url: v.url, createdAt: d.createdAt };
      }),
    };
  }
}
