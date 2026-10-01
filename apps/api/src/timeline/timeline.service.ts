import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { describeEntryForOwner } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";

type Bi = { ar: string; en: string };
export interface TimelineEvent {
  key: string;
  kind: "born" | "birthday" | "joined" | "vaccine" | "visit" | "clinical" | "weight" | "handover" | "lost" | "reunion" | "moment";
  at: Date;
  title: Bi;
  sub?: Bi | null;
  photoUrl?: string | null;
  momentId?: string;
}

const ORDINAL_AR = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
const ordinalEn = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/**
 * The cat's life, in one ordered list (W9 — "a digital family album").
 *
 * Merges what the record already knows — birth and birthdays, joining the
 * register, every dose, every visit, what clinics recorded, weight milestones,
 * hand-overs, a lost spell and the reunion — with the moments the owner adds.
 * Everything belongs to the CAT: a new owner inherits the album, but never the
 * names of the people who held it before (hand-overs show only the date).
 */
@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedCat(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, userId, deletedAt: null },
      select: { id: true, name: true, birthDate: true, idIssuedAt: true, createdAt: true, photoUrl: true, catIdNumber: true },
    });
    if (!cat) throw new NotFoundException("Cat not found");
    return cat;
  }

  async timeline(userId: string, catId: string): Promise<TimelineEvent[]> {
    const cat = await this.ownedCat(userId, catId);
    const now = new Date();
    const [vaccinations, ownerVisits, clinicVisits, entries, weights, ownership, lost, moments] = await Promise.all([
      this.prisma.catVaccination.findMany({ where: { catId }, select: { id: true, name: true, administeredAt: true, orgId: true } }),
      this.prisma.catVetVisit.findMany({ where: { catId }, select: { id: true, visitedAt: true, reason: true, clinic: true } }),
      this.prisma.visit.findMany({
        where: { catId },
        select: { id: true, checkedInAt: true, reason: true, org: { select: { nameAr: true, nameEn: true } } },
      }),
      this.prisma.clinicalEntry.findMany({
        where: { catId, status: "FINAL", retractedAt: null, type: { in: ["SURGERY", "DIAGNOSIS", "DENTAL", "HOSPITALIZATION"] } },
        select: { id: true, type: true, occurredAt: true, payload: true },
        take: 50,
      }),
      this.prisma.catWeightRecord.findMany({ where: { catId, deletedAt: null }, orderBy: { measuredAt: "asc" }, select: { id: true, weightKg: true, measuredAt: true } }),
      this.prisma.catOwnershipRecord.findMany({ where: { catId, fromUserId: { not: null } }, select: { id: true, at: true, reason: true } }),
      this.prisma.lostFoundPost.findMany({ where: { catId, kind: "LOST" }, select: { id: true, happenedAt: true, reunitedAt: true } }),
      this.prisma.catMoment.findMany({ where: { catId }, orderBy: { happenedAt: "desc" } }),
    ]);

    const ev: TimelineEvent[] = [];
    if (cat.birthDate) {
      ev.push({ key: "born", kind: "born", at: cat.birthDate, title: { ar: `وُلد ${cat.name}`, en: `${cat.name} was born` } });
      // Birthdays that have already happened — the album remembers each one.
      for (let y = 1; y <= 25; y++) {
        const d = new Date(cat.birthDate);
        d.setFullYear(d.getFullYear() + y);
        if (d > now) break;
        ev.push({
          key: `birthday-${y}`,
          kind: "birthday",
          at: d,
          title: { ar: `عيد ميلاده ${ORDINAL_AR[y] ?? `رقم ${y}`}`, en: `${ordinalEn(y)} birthday` },
        });
      }
    }
    ev.push({
      key: "joined",
      kind: "joined",
      at: cat.idIssuedAt ?? cat.createdAt,
      title: { ar: "انضم إلى سجل مرقط", en: "Joined the Moracat register" },
      sub: cat.catIdNumber ? { ar: cat.catIdNumber, en: cat.catIdNumber } : null,
    });
    for (const v of vaccinations) {
      ev.push({ key: `vax-${v.id}`, kind: "vaccine", at: v.administeredAt, title: { ar: `تطعيم: ${v.name}`, en: `Vaccine: ${v.name}` }, sub: v.orgId ? { ar: "سجّلته العيادة", en: "Recorded by the clinic" } : null });
    }
    for (const v of ownerVisits) {
      ev.push({ key: `ovisit-${v.id}`, kind: "visit", at: v.visitedAt, title: { ar: "زيارة طبيب", en: "Vet visit" }, sub: v.reason || v.clinic ? { ar: [v.reason, v.clinic].filter(Boolean).join(" · "), en: [v.reason, v.clinic].filter(Boolean).join(" · ") } : null });
    }
    for (const v of clinicVisits) {
      ev.push({ key: `cvisit-${v.id}`, kind: "visit", at: v.checkedInAt, title: { ar: "زيارة عيادة", en: "Clinic visit" }, sub: { ar: v.org.nameAr, en: v.org.nameEn } });
    }
    for (const e of entries) {
      const owner = describeEntryForOwner(e.type, e.payload);
      if (owner) ev.push({ key: `entry-${e.id}`, kind: "clinical", at: e.occurredAt, title: owner.title, sub: owner.summary ?? null });
    }
    // Weight milestones only: the first weigh-in, then every change of ≥ 0.5 kg.
    let lastMark: number | null = null;
    for (const w of weights) {
      if (lastMark === null || Math.abs(w.weightKg - lastMark) >= 0.5) {
        const first = lastMark === null;
        lastMark = w.weightKg;
        ev.push({
          key: `w-${w.id}`,
          kind: "weight",
          at: w.measuredAt,
          title: first ? { ar: `أول وزن: ${w.weightKg} كغ`, en: `First weigh-in: ${w.weightKg} kg` } : { ar: `صار وزنه ${w.weightKg} كغ`, en: `Now ${w.weightKg} kg` },
        });
      }
    }
    for (const o of ownership) {
      ev.push({ key: `own-${o.id}`, kind: "handover", at: o.at, title: o.reason === "ADOPTION" ? { ar: "تبنّته عائلة جديدة", en: "Adopted into a new family" } : { ar: "انتقل إلى بيت جديد", en: "Moved to a new home" } });
    }
    for (const l of lost) {
      ev.push({ key: `lost-${l.id}`, kind: "lost", at: l.happenedAt, title: { ar: "ضاع", en: "Went missing" } });
      if (l.reunitedAt) ev.push({ key: `reunion-${l.id}`, kind: "reunion", at: l.reunitedAt, title: { ar: "رجع للبيت", en: "Came home" } });
    }
    for (const m of moments) {
      ev.push({ key: `m-${m.id}`, kind: "moment", at: m.happenedAt, title: { ar: m.title, en: m.title }, sub: m.note ? { ar: m.note, en: m.note } : null, photoUrl: m.photoUrl, momentId: m.id });
    }
    return ev.sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  async addMoment(userId: string, catId: string, dto: { title: string; note?: string; photoUrl?: string; happenedAt?: string }) {
    await this.ownedCat(userId, catId);
    const title = dto.title?.trim().slice(0, 120);
    if (!title) throw new BadRequestException("A title is required");
    const at = dto.happenedAt ? new Date(dto.happenedAt) : new Date();
    if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + 86_400_000) throw new BadRequestException("Choose a date that isn't in the future");
    // Photos come from our own upload endpoint — never an arbitrary URL.
    const photo = dto.photoUrl && /^https:\/\/|^http:\/\/localhost/.test(dto.photoUrl) ? dto.photoUrl : null;
    return this.prisma.catMoment.create({
      data: { catId, title, note: dto.note?.trim().slice(0, 600) || null, photoUrl: photo, happenedAt: at },
    });
  }

  async deleteMoment(userId: string, catId: string, momentId: string) {
    await this.ownedCat(userId, catId);
    const res = await this.prisma.catMoment.deleteMany({ where: { id: momentId, catId } });
    if (!res.count) throw new NotFoundException("Moment not found");
    return { success: true };
  }

  /**
   * The yearly keepsake «عام {cat}» (W10): one year of the album, summarised
   * like an editorial annual report — never a dashboard of metrics.
   */
  async year(userId: string, catId: string, year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear()) throw new BadRequestException("Choose a past or current year");
    const cat = await this.ownedCat(userId, catId);
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    const all = await this.timeline(userId, catId);
    const inYear = all.filter((e) => e.at >= from && e.at < to);
    const weights = await this.prisma.catWeightRecord.findMany({
      where: { catId, deletedAt: null, measuredAt: { gte: from, lt: to } },
      orderBy: { measuredAt: "asc" },
      select: { weightKg: true, measuredAt: true },
    });
    const photos = await this.prisma.catPhoto.findMany({
      where: { catId, createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: "asc" },
      take: 9,
      select: { url: true },
    }).catch(() => [] as { url: string }[]);
    const momentPhotos = inYear.filter((e) => e.photoUrl).map((e) => e.photoUrl as string);
    const ageEnd = cat.birthDate ? Math.max(0, Math.floor((Math.min(to.getTime(), Date.now()) - cat.birthDate.getTime()) / (30.44 * 86_400_000))) : null;
    return {
      year,
      cat: { name: cat.name, photoUrl: cat.photoUrl, catIdNumber: cat.catIdNumber },
      ageMonthsAtEnd: ageEnd,
      weight: weights.length ? { start: weights[0]!.weightKg, end: weights[weights.length - 1]!.weightKg, count: weights.length } : null,
      counts: {
        vaccines: inYear.filter((e) => e.kind === "vaccine").length,
        visits: inYear.filter((e) => e.kind === "visit").length,
        moments: inYear.filter((e) => e.kind === "moment").length,
      },
      photos: [...momentPhotos, ...photos.map((p) => p.url)].slice(0, 9),
      milestones: inYear.filter((e) => e.kind !== "weight").slice(0, 24),
    };
  }
}
