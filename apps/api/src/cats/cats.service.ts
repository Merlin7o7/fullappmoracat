import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  PayloadTooLargeException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma } from "@moraqat/db";
import {
  foundingClassLabel,
  isFoundingMember,
  normaliseSourceCode,
  saudiCityLabel,
} from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { IdsService } from "../ids/ids.service";
import { StorageService } from "../storage/storage.service";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EventsService } from "../events/events.service";
import { FilesService } from "../files/files.service";
import { deriveVaccinationStatus, describeEntryForOwner } from "@moraqat/core";
import type { EmergencyContactDto, HealthProfileDto } from "./dto/cat-health.dto";
import { catIdIssuedTemplate } from "../mail/mail.templates";
import { normalizeName } from "../common/text";
import type { UpdateVisibilityDto } from "./dto/cat-visibility.dto";

/** Minimal shape of a multer-parsed upload (avoids an extra @types/multer dep). */
export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB (client compresses before upload)
const MAX_GALLERY_PHOTOS = 12;
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

type CatRow = {
  id: string;
  name: string;
  catIdNumber: string | null;
  /** The census ordinal — this cat's place in the national count. */
  catNumber: number;
  /** Census city code (packages/core SAUDI_CITIES); null for pre-census cats. */
  cityCode: string | null;
  qrToken: string | null;
  idIssuedAt: Date | null;
  photoUrl: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  publicSlug: string | null;
  gender: string;
  birthDate: Date | null;
  vaccinationStatus: string | null;
  weightKg: number | null;
  lifeStage: string | null;
  activityLevel: string;
  isIndoor: boolean;
  status: string;
  membershipStatus: string;
  archivedAt: Date | null;
  deceasedAt: Date | null;
  microchipNo: string | null;
  coatColor: string | null;
  isNeutered: boolean | null;
  currentMedications: string | null;
  emergencyNotes: string | null;
  diet: string | null;
  vetNotes: string | null;
  favoriteFoods: string[];
  preferredBrand: string[];
  currentFood: string | null;
  acquisitionSource: string | null;
  district: string | null;
  homeBranchId: string | null;
  lostModeAt: Date | null;
  profile: unknown;
  createdAt: Date;
  breed?: { nameEn: string; nameAr: string } | null;
  healthConds?: { id: string; name: string; notes: string | null }[];
  allergies?: { id: string; allergen: string }[];
};

/**
 * The single source of truth for cat *scalar* fields writable by an owner.
 * Both create() and update() map through this, so a field can never again be
 * accepted by the DTO yet silently dropped on one path (the "complete the file"
 * data-loss bug). Prisma treats `undefined` as "leave unchanged", so on create
 * the schema defaults apply and on update only provided fields move.
 */
function catScalarData(dto: Partial<CreateCatDto>) {
  return {
    name: dto.name,
    // Keep the search-folded copy in step whenever the name changes.
    ...(dto.name !== undefined ? { nameNormalized: normalizeName(dto.name) } : {}),
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
    coatColor: dto.coatColor,
    isNeutered: dto.isNeutered,
    vaccinationStatus: dto.vaccinationStatus,
    currentMedications: dto.currentMedications,
    emergencyNotes: dto.emergencyNotes,
    // The census city. Unlike sourceCode (write-once attribution), this IS
    // editable: people move, and a card that names the wrong city is the bug
    // this field was added to fix.
    cityCode: dto.cityCode,
    // Undefined leaves it unchanged (Prisma); an object replaces it wholesale —
    // the journey always sends the complete merged profile, so replace is safe
    // and simpler than a deep server merge. Always sanitised first (never raw).
    profile: dto.profile === undefined ? undefined : sanitizeProfile(dto.profile),
  };
}

/* ── Profile sanitiser ──────────────────────────────────────────────────────
 * The `profile` blob is owner-authored and free-form by design. It is never
 * trusted raw: we whitelist the four sections, coerce every leaf to a bounded
 * string / number / boolean, and cap counts — so it can never grow unbounded,
 * smuggle nested objects, or carry markup into the record. Shape mirrors the
 * web `CatProfile` type; anything unexpected is dropped, not rejected, so a
 * newer client can't 500 an older server.
 */
const PROFILE_SECTIONS = ["about", "personality", "favorites", "fun"] as const;
const MAX_ANSWERS_PER_SECTION = 40;
const MAX_ANSWER_LEN = 160;
const MAX_MULTI = 24;
const MAX_STICKERS = 14;

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}
function num(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(hi, Math.max(lo, n));
}

function sanitizeAnswers(raw: unknown): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (!raw || typeof raw !== "object") return out;
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_ANSWERS_PER_SECTION) break;
    const key = str(k, 40);
    if (!key) continue;
    if (Array.isArray(v)) {
      const arr = v.map((x) => str(x, MAX_ANSWER_LEN)).filter((x): x is string => !!x).slice(0, MAX_MULTI);
      if (arr.length) { out[key] = arr; count++; }
    } else {
      const val = str(v, MAX_ANSWER_LEN);
      if (val) { out[key] = val; count++; }
    }
  }
  return out;
}

function sanitizeProfile(raw: unknown): Prisma.InputJsonValue {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, Prisma.InputJsonValue> = {};

  for (const section of PROFILE_SECTIONS) {
    const answers = sanitizeAnswers(src[section]);
    if (Object.keys(answers).length) out[section] = answers;
  }

  const p = src.personalization;
  if (p && typeof p === "object") {
    const pp = p as Record<string, unknown>;
    const personalization: Record<string, Prisma.InputJsonValue> = {};
    const theme = str(pp.theme, 40);
    const accent = str(pp.accent, 40);
    const frame = str(pp.frame, 40);
    if (theme) personalization.theme = theme;
    if (accent) personalization.accent = accent;
    if (frame) personalization.frame = frame;
    if (Array.isArray(pp.stickers)) {
      const stickers = pp.stickers
        .map((s) => {
          if (!s || typeof s !== "object") return null;
          const so = s as Record<string, unknown>;
          const id = str(so.id, 40);
          if (!id) return null;
          return {
            id,
            x: num(so.x, 0, 1) ?? 0.5,
            y: num(so.y, 0, 1) ?? 0.5,
            scale: num(so.scale, 0.3, 3) ?? 1,
            rotate: num(so.rotate, -180, 180) ?? 0,
            ...(so.flip === true ? { flip: true } : {}),
          };
        })
        .filter(Boolean)
        .slice(0, MAX_STICKERS);
      if (stickers.length) personalization.stickers = stickers;
    }
    if (Object.keys(personalization).length) out.personalization = personalization;
  }

  return out;
}

@Injectable()
export class CatsService implements OnModuleInit {
  private readonly logger = new Logger("Cats");

  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly events: EventsService,
    private readonly files: FilesService
  ) {}

  /**
   * One-time, boot-time backfill. Any legacy cat missing a Cat ID / QR token or a
   * normalized-name is repaired here — so the hot read paths (findAll/findOne)
   * stay strictly read-only (no writes in a request loop). New cats always get
   * these at create, so this is a no-op in steady state.
   */
  async onModuleInit() {
    // Best-effort, bounded, and crash-proof: repairs at most BATCH legacy rows per
    // boot and never throws (a unique-collision from two instances booting together
    // must not crash-loop the deploy). New cats always get these fields at create,
    // so this is a no-op in steady state and fully drains over a few restarts.
    const BATCH = 500;
    try {
      const stale = await this.prisma.cat.findMany({
        where: {
          deletedAt: null,
          OR: [{ catIdNumber: null }, { qrToken: null }, { nameNormalized: null }],
        },
        select: { id: true, name: true, catIdNumber: true, qrToken: true, idIssuedAt: true },
        take: BATCH,
      });
      if (!stale.length) return;
      let repaired = 0;
      for (const c of stale) {
        try {
          await this.prisma.cat.update({
            where: { id: c.id },
            data: {
              catIdNumber: c.catIdNumber ?? (await this.ids.newCatId()),
              qrToken: c.qrToken ?? (await this.ids.newQrToken()),
              idIssuedAt: c.idIssuedAt ?? new Date(),
              nameNormalized: normalizeName(c.name),
            },
          });
          repaired++;
        } catch (err) {
          // Another instance likely repaired this row first — skip, don't crash.
          this.logger.warn(`Backfill skipped cat ${c.id}: ${(err as Error).message}`);
        }
      }
      this.logger.log(`Backfilled identity/search fields for ${repaired} legacy cat(s).`);
    } catch (err) {
      this.logger.error(`Boot backfill failed (non-fatal): ${(err as Error).message}`);
    }
  }

  async create(userId: string, dto: CreateCatDto) {
    // Community visibility is opt-out (decision 2026-08-14): a new cat joins the
    // community feed by default, anonymously (showOwnerName/showCity stay false),
    // and only renders once it has a photo (community.service baseWhere). The
    // wizard's ShareNotice toggle is the opt-out; the manage panel remains the
    // ongoing switch either way.
    const share = dto.sharePublicly !== false;
    const cat = await this.prisma.cat.create({
      data: {
        userId,
        ...(share
          ? {
              isPublic: true,
              sharedAt: new Date(),
              publicSlug: await this.makePublicSlug(dto.name),
              // PDPL people-in-photo attestation (R106): the upload act is the
              // consent signal; the client only ever says "confirmed" and only
              // alongside an actual photo — the timestamp is minted here.
              ...(dto.shareConsent === true && dto.photoUrl ? { shareConsentAt: new Date() } : {}),
            }
          : {}),
        // The Cat ID + its QR token are issued the moment the cat joins — instantly,
        // so the reveal ceremony (R031) has something real to celebrate. Membership
        // stays INACTIVE (schema default) until a subscription activates it (#9).
        catIdNumber: await this.ids.newCatId(),
        qrToken: await this.ids.newQrToken(),
        idIssuedAt: new Date(),
        // Where this registration came from — `?src=stand-004` off a physical
        // stand's QR tile (MRC-GTM-001 §2). Normalised, never trusted raw, and
        // written ONLY here: per-stand yield decides the Year-1 channel strategy
        // and is impossible to reconstruct after the fact, so it is captured at
        // birth and never overwritten by a later edit.
        sourceCode: normaliseSourceCode(dto.sourceCode),
        ...catScalarData(dto),
        // name is required on create (the shared helper types it optional for the
        // update path); re-assert it so Prisma sees a definite string.
        name: dto.name,
        allergies: dto.allergies?.length
          ? { create: dto.allergies.map((allergen) => ({ allergen })) }
          : undefined,
        healthConds: dto.healthConditions?.length
          ? { create: dto.healthConditions.map((name) => ({ name })) }
          : undefined,
      },
      include: catInclude,
    });
    this.events.emit("cat_id_issued", {
      userId,
      catId: cat.id,
      props: { origin: "OWNER", src: cat.sourceCode ?? null, city: cat.cityCode ?? null, hasPhoto: !!cat.photoUrl },
    });

    // The first cat a household adds becomes the Primary Cat automatically —
    // the featured identity + greeting subject (multi-cat requirement). No extra
    // step for single-cat owners (R005 one clear action).
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCatId: true, email: true, firstName: true, locale: true, onboardedAt: true },
    });
    if (!user?.primaryCatId) {
      await this.prisma.user.update({ where: { id: userId }, data: { primaryCatId: cat.id } });
    }

    // First-ever Cat ID → route this member through the one-time welcome (Stage 4
    // ceremony hand-off, R031). We stamp onboardedAt now so it fires exactly once;
    // subsequent cats go straight back to the dashboard.
    const firstCatIdIssued = !user?.onboardedAt;
    if (firstCatIdIssued) {
      await this.prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } });
    }

    // Someone who joined saying "I don't have a cat yet" now does. Clearing the
    // flag here rather than asking them to is the point of having it: the
    // explore home turns into a real home by itself (R002).
    await this.prisma.user.updateMany({
      where: { id: userId, noCatYetAt: { not: null } },
      data: { noCatYetAt: null },
    });

    // Celebrate the Cat ID the moment it's issued (R031/R073 — the reveal is the
    // hero moment; the email + in-app note are its echo). Fire-and-forget so they
    // never block or fail the create; dev/log mail is a no-op without a key.
    if (cat.catIdNumber) {
      this.notifications.emit(userId, {
        category: "COMMUNITY",
        type: "cat_id_issued",
        params: { name: cat.name, catIdNumber: cat.catIdNumber },
        data: { kind: "cat_id_issued", catId: cat.id, catIdNumber: cat.catIdNumber },
      });
      if (user?.email) {
        const tpl = catIdIssuedTemplate(
          user.locale === "en" ? "en" : "ar",
          cat.name,
          cat.catIdNumber
        );
        void this.mail.send({ to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      }
    }

    // The publish receipt (R024 spirit): sharing happened by default, so the
    // disclosure must be explicit — the note names the off switch.
    if (share) {
      this.notifications.emit(userId, {
        category: "COMMUNITY",
        type: "cat_made_public",
        params: { name: cat.name },
        data: { kind: "cat_made_public", slug: cat.publicSlug },
      });
    }

    return { ...this.serialize(cat as CatRow, user?.primaryCatId ?? cat.id), firstCatIdIssued };
  }

  /** Breeds for the registration wizard's picker. */
  listBreeds() {
    return this.prisma.breed.findMany({
      orderBy: { nameEn: "asc" },
      select: { id: true, nameEn: true, nameAr: true },
    });
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

    // Identity issuance is guaranteed at create time and repaired once at boot
    // (onModuleInit) — so this read path stays strictly read-only (no per-row
    // writes in a request loop). See onModuleInit for the legacy backfill.

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

    // Replace the health collections and the scalar fields atomically. Before,
    // the deleteMany ran outside any transaction and *before* the update — a
    // failed update (bad breedId FK, DB hiccup) permanently wiped allergies /
    // conditions while the user saw "Couldn't save". Now it is all-or-nothing.
    const cat = await this.prisma.$transaction(async (tx) => {
      if (dto.allergies !== undefined) {
        await tx.catAllergy.deleteMany({ where: { catId: id } });
      }
      if (dto.healthConditions !== undefined) {
        await tx.catHealthCondition.deleteMany({ where: { catId: id } });
      }
      return tx.cat.update({
        where: { id },
        data: {
          ...catScalarData(dto),
          allergies: dto.allergies?.length
            ? { create: dto.allergies.map((allergen) => ({ allergen })) }
            : undefined,
          healthConds: dto.healthConditions?.length
            ? { create: dto.healthConditions.map((name) => ({ name })) }
            : undefined,
        },
        include: catInclude,
      });
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
    // Restore the lifecycle status only — NEVER re-grant membership. Membership
    // is earned by an active subscription (and is disabled in Community Mode);
    // unconditionally setting ACTIVE here handed archived cats a free "Member"
    // badge + membershipActive in /verify. Leave membershipStatus untouched.
    const cat = await this.prisma.cat.update({
      where: { id },
      data: { status: "ACTIVE", archivedAt: null, deceasedAt: null },
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
    // Collect the cat's stored image objects BEFORE we soft-delete, so we can
    // free them from object storage (the row is only soft-deleted, so the DB
    // cascade never fires for CatPhoto — without this the files would orphan in
    // the bucket forever, a cost + privacy leak).
    const [cat, galleryPhotos] = await Promise.all([
      this.prisma.cat.findUnique({ where: { id }, select: { photoUrl: true, coverUrl: true } }),
      this.prisma.catPhoto.findMany({ where: { catId: id }, select: { url: true } }),
    ]);

    // Soft-delete AND withdraw from every public surface in one atomic write, so
    // a deleted cat can never linger in the community browse, the featured rail,
    // or resolve via its public slug — the community queries already filter
    // deletedAt, but resetting these keeps the row honest and means a future
    // restore comes back private-by-default rather than silently re-shared.
    await this.prisma.cat.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isPublic: false,
        isFeatured: false,
        featuredAt: null,
        // Release the public handle so it can't resolve or surface in anyone's
        // "my-likes" (which filters on a non-null slug) after deletion.
        publicSlug: null,
      },
    });
    // Drop likes on the removed cat (the row is soft-deleted, so the CatLike
    // FK cascade won't fire) — keeps like tallies and my-likes honest.
    await this.prisma.catLike.deleteMany({ where: { catId: id } });
    // Remove the image objects (profile, cover, gallery) — best-effort, never
    // blocks the delete. keyFromUrl only touches our own namespaces, so an
    // external avatar URL is safely skipped.
    for (const url of [cat?.photoUrl, cat?.coverUrl, ...galleryPhotos.map((p) => p.url)]) {
      if (url) void this.storage.remove(url);
    }
    // Drop the gallery rows too (their objects are now gone; a soft-deleted cat
    // is never restored — restore() requires deletedAt: null). Remaining child
    // rows (health, vaccinations, feeding recs, subscription links, likes)
    // cascade at the DB via onDelete: Cascade on their FKs when the row is purged.
    await this.prisma.catPhoto.deleteMany({ where: { catId: id } });
    await this.reassignPrimaryIfNeeded(userId, id);
    return { success: true };
  }

  // ── Merge (MRC-PROD-001 T4) ─────────────────────────────────────────────────

  /**
   * Fold `sourceId` into `targetId`: every record moves to the survivor, the
   * survivor's blanks are filled from the source, and the source is soft-
   * deleted with a pointer to where it went. Used when an owner claims a
   * clinic-created cat that is one they already registered, and by admin.
   *
   * Uniqueness-aware: likes, reports and membership links that would collide
   * on the target are dropped from the source rather than failing the merge.
   * Both cats must belong to the same owner — ownership is never transferred
   * by a merge.
   */
  async merge(sourceId: string, targetId: string, opts: { actorUserId?: string; reason?: string } = {}) {
    if (sourceId === targetId) throw new BadRequestException("A cat cannot be merged into itself");
    const [source, target] = await Promise.all([
      this.prisma.cat.findFirst({ where: { id: sourceId, deletedAt: null } }),
      this.prisma.cat.findFirst({ where: { id: targetId, deletedAt: null } }),
    ]);
    if (!source || !target) throw new NotFoundException("Cat not found");
    if (source.userId !== target.userId) throw new BadRequestException("Both cats must belong to the same owner");

    await this.prisma.$transaction(async (tx) => {
      const move = { where: { catId: sourceId }, data: { catId: targetId } };
      await tx.catVaccination.updateMany(move);
      await tx.clinicalEntry.updateMany(move);
      await tx.prescription.updateMany(move);
      await tx.catWeightRecord.updateMany(move);
      await tx.catDocument.updateMany(move);
      await tx.catPhoto.updateMany(move);
      await tx.consentGrant.updateMany(move);
      await tx.recordAccessLog.updateMany(move);
      await tx.visit.updateMany(move);
      await tx.catVetVisit.updateMany(move);
      await tx.catEmergencyContact.updateMany(move);
      await tx.feedingRecommendation.updateMany(move);
      await tx.claimInvite.updateMany(move);

      // Collision-aware moves.
      const targetLikers = (await tx.catLike.findMany({ where: { catId: targetId }, select: { userId: true } })).map((l) => l.userId);
      await tx.catLike.updateMany({ where: { catId: sourceId, userId: { notIn: targetLikers } }, data: { catId: targetId } });
      await tx.catLike.deleteMany({ where: { catId: sourceId } });
      const targetReporters = (await tx.catReport.findMany({ where: { catId: targetId }, select: { reporterId: true } }))
        .map((r) => r.reporterId)
        .filter((id): id is string => !!id);
      await tx.catReport.updateMany({ where: { catId: sourceId, reporterId: { notIn: targetReporters } }, data: { catId: targetId } });
      await tx.catReport.deleteMany({ where: { catId: sourceId } });
      const targetSubs = (await tx.subscriptionCat.findMany({ where: { catId: targetId }, select: { subscriptionId: true } })).map((s) => s.subscriptionId);
      await tx.subscriptionCat.updateMany({ where: { catId: sourceId, subscriptionId: { notIn: targetSubs } }, data: { catId: targetId } });
      await tx.subscriptionCat.deleteMany({ where: { catId: sourceId } });

      // Fill the survivor's blanks from the source; never overwrite a known value.
      await tx.cat.update({
        where: { id: targetId },
        data: {
          microchipNo: target.microchipNo ?? source.microchipNo,
          birthDate: target.birthDate ?? source.birthDate,
          breedId: target.breedId ?? source.breedId,
          coatColor: target.coatColor ?? source.coatColor,
          gender: target.gender === "UNKNOWN" ? source.gender : target.gender,
          homeBranchId: target.homeBranchId ?? source.homeBranchId,
          photoUrl: target.photoUrl ?? source.photoUrl,
          likeCount: { increment: 0 },
        },
      });
      await tx.cat.update({
        where: { id: sourceId },
        data: { deletedAt: new Date(), status: "ARCHIVED", mergedIntoCatId: targetId, isPublic: false },
      });
      await tx.user.updateMany({ where: { primaryCatId: sourceId }, data: { primaryCatId: targetId } });
      await tx.auditLog.create({
        data: {
          userId: opts.actorUserId ?? null,
          action: "cat.merge",
          entityType: "Cat",
          entityId: targetId,
          metadata: { sourceId, targetId, reason: opts.reason ?? null },
        },
      });
    });
    this.events.emit("cat_merged", { userId: target.userId, catId: targetId, props: { reason: opts.reason ?? null } });
    return { mergedInto: targetId, removed: sourceId };
  }

  // ── The living record (MRC-PROD-001 T3) ─────────────────────────────────────

  /**
   * Everything the owner may see about their cat's health, in one read.
   *
   * Clinic-written entries are projected through `describeEntryForOwner`
   * (packages/core) — the single place that decides which clinical facts leave
   * the clinic portal. Drafts, retractions, superseded revisions and NOTE
   * entries never appear here; a vet's free text stays with the vet.
   */
  async getHealth(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        microchipNo: true,
        currentMedications: true,
        currentFood: true,
        emergencyNotes: true,
        acquisitionSource: true,
        district: true,
        homeBranchId: true,
        homeBranch: {
          select: { id: true, nameAr: true, nameEn: true, phone: true, org: { select: { nameAr: true, nameEn: true } } },
        },
        allergies: { select: { allergen: true } },
        healthConds: { select: { name: true } },
        emergencyContacts: { orderBy: { isPrimary: "desc" }, take: 1, select: { name: true, phone: true, relation: true } },
        vaccinations: { orderBy: { administeredAt: "desc" } },
        weightRecords: { orderBy: { measuredAt: "asc" }, select: { id: true, weightKg: true, bcs: true, measuredAt: true, source: true } },
        prescriptions: {
          orderBy: { issuedAt: "desc" },
          take: 50,
          select: {
            id: true, medication: true, strength: true, form: true, dosage: true, frequency: true,
            durationDays: true, status: true, issuedAt: true, org: { select: { nameAr: true, nameEn: true } },
          },
        },
        clinicalEntries: {
          where: { status: "FINAL", retractedAt: null, type: { not: "NOTE" } },
          orderBy: { occurredAt: "desc" },
          take: 200,
          select: {
            id: true, type: true, payload: true, occurredAt: true, visitId: true, org: { select: { nameAr: true, nameEn: true } },
            // Metadata only — the bytes open through an owner-scoped, signed link (T12).
            attachments: { select: { id: true, fileName: true, mime: true, kind: true, createdAt: true } },
          },
        },
        visits: {
          orderBy: { checkedInAt: "desc" },
          take: 50,
          select: {
            id: true, checkedInAt: true, closedAt: true, state: true, reason: true, ownerSummary: true,
            summarySentAt: true, followUpAt: true, org: { select: { nameAr: true, nameEn: true } },
          },
        },
      },
    });
    if (!cat) throw new NotFoundException("Cat not found");

    // Clinic names for clinic-written vaccinations (orgId is set by the
    // clinical write-through; owner-entered doses carry only a free-text clinic).
    const orgIds = [...new Set(cat.vaccinations.map((v) => v.orgId).filter((x): x is string => !!x))];
    const orgs = orgIds.length
      ? await this.prisma.partnerOrg.findMany({ where: { id: { in: orgIds } }, select: { id: true, nameAr: true, nameEn: true } })
      : [];
    const orgName = new Map(orgs.map((o) => [o.id, { ar: o.nameAr, en: o.nameEn }]));

    const standing = deriveVaccinationStatus(cat.vaccinations);
    this.events.emit("health_page_viewed", { userId, catId, props: { entries: cat.clinicalEntries.length } });

    return {
      cat: {
        id: cat.id,
        name: cat.name,
        microchipNo: cat.microchipNo,
        allergies: cat.allergies.map((a) => a.allergen),
        healthConditions: cat.healthConds.map((h) => h.name),
        currentMedications: cat.currentMedications,
        currentFood: cat.currentFood,
        emergencyNotes: cat.emergencyNotes,
        acquisitionSource: cat.acquisitionSource,
        district: cat.district,
        homeBranch: cat.homeBranch
          ? {
              id: cat.homeBranch.id,
              name: { ar: cat.homeBranch.nameAr, en: cat.homeBranch.nameEn },
              clinic: { ar: cat.homeBranch.org.nameAr, en: cat.homeBranch.org.nameEn },
              phone: cat.homeBranch.phone,
            }
          : null,
        emergencyContact: cat.emergencyContacts[0] ?? null,
      },
      vaccination: {
        ...standing,
        records: cat.vaccinations.map((v) => ({
          id: v.id,
          name: v.name,
          administeredAt: v.administeredAt,
          dueAt: v.dueAt,
          vetName: v.vetName,
          clinic: (v.orgId && orgName.get(v.orgId)) || (v.clinic ? { ar: v.clinic, en: v.clinic } : null),
          // Written by a partner clinic (verified) vs typed by the owner.
          verified: !!v.orgId,
        })),
      },
      weights: cat.weightRecords,
      prescriptions: cat.prescriptions.map((rx) => ({
        id: rx.id,
        medication: rx.medication,
        strength: rx.strength,
        form: rx.form,
        dosage: rx.dosage,
        frequency: rx.frequency,
        durationDays: rx.durationDays,
        status: rx.status,
        issuedAt: rx.issuedAt,
        clinic: { ar: rx.org.nameAr, en: rx.org.nameEn },
      })),
      clinicalEntries: cat.clinicalEntries
        .map((e) => {
          const owner = describeEntryForOwner(e.type, e.payload);
          return owner
            ? {
                id: e.id,
                type: e.type,
                occurredAt: e.occurredAt,
                visitId: e.visitId,
                clinic: { ar: e.org.nameAr, en: e.org.nameEn },
                attachments: e.attachments.map((a) => ({ id: a.id, fileName: a.fileName, mime: a.mime, kind: a.kind, createdAt: a.createdAt })),
                ...owner,
              }
            : null;
        })
        .filter((e): e is NonNullable<typeof e> => e !== null),
      visits: cat.visits.map((v) => ({
        id: v.id,
        checkedInAt: v.checkedInAt,
        closedAt: v.closedAt,
        state: v.state,
        reason: v.reason,
        ownerSummary: v.ownerSummary,
        summarySentAt: v.summarySentAt,
        followUpAt: v.followUpAt,
        clinic: { ar: v.org.nameAr, en: v.org.nameEn },
      })),
    };
  }

  /**
   * Open one attachment on the owner's own record (T12): the entry must be
   * FINAL and not retracted (the same projection rule as getHealth), and the
   * bytes come back as a 5-minute signed link — never a public object.
   */
  async getHealthAttachment(userId: string, catId: string, attachmentId: string) {
    await this.ownedCat(userId, catId);
    const a = await this.prisma.entryAttachment.findFirst({
      where: { id: attachmentId, entry: { catId, status: "FINAL", retractedAt: null } },
      select: { id: true, fileUrl: true, fileName: true, mime: true, kind: true },
    });
    if (!a) throw new NotFoundException("Attachment not found");
    const url = a.fileUrl.startsWith("private:")
      ? this.files.linkFor({ key: a.fileUrl.slice("private:".length), mime: a.mime ?? "application/octet-stream", fileName: a.fileName ?? "attachment" })
      : a.fileUrl;
    return { id: a.id, url, fileName: a.fileName, mime: a.mime, kind: a.kind };
  }

  /**
   * The owner-maintained health profile. PATCH semantics: absent = unchanged,
   * null = cleared, a list = replaced (this is the one deliberate list editor,
   * so an empty list here IS a decision). The home clinic must be a live,
   * directory-visible branch — the owner can only route reminders somewhere
   * that exists.
   */
  async updateHealthProfile(userId: string, catId: string, dto: HealthProfileDto) {
    await this.ownedCat(userId, catId);
    if (dto.homeBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.homeBranchId, isActive: true, org: { status: "LIVE", isDemo: false } },
        select: { id: true },
      });
      if (!branch) throw new BadRequestException("Unknown clinic");
    }
    await this.prisma.$transaction(async (tx) => {
      if (dto.allergies !== undefined) {
        await tx.catAllergy.deleteMany({ where: { catId } });
        if (dto.allergies.length) {
          await tx.catAllergy.createMany({ data: [...new Set(dto.allergies.map((a) => a.trim()).filter(Boolean))].map((allergen) => ({ catId, allergen })) });
        }
      }
      if (dto.healthConditions !== undefined) {
        await tx.catHealthCondition.deleteMany({ where: { catId } });
        if (dto.healthConditions.length) {
          await tx.catHealthCondition.createMany({ data: [...new Set(dto.healthConditions.map((n) => n.trim()).filter(Boolean))].map((name) => ({ catId, name })) });
        }
      }
      await tx.cat.update({
        where: { id: catId },
        data: {
          microchipNo: dto.microchipNo,
          currentMedications: dto.currentMedications,
          currentFood: dto.currentFood,
          emergencyNotes: dto.emergencyNotes,
          acquisitionSource: dto.acquisitionSource,
          district: dto.district,
          homeBranchId: dto.homeBranchId,
        },
      });
    });
    this.events.emit("cat_updated", {
      userId,
      catId,
      props: { surface: "health_profile", fields: Object.keys(dto).filter((k) => (dto as Record<string, unknown>)[k] !== undefined).join(",") },
    });
    return this.getHealth(userId, catId);
  }

  /** Lost mode (T6): a timestamp, so "since when" is on the record. */
  async setLostMode(userId: string, catId: string, enabled: boolean) {
    await this.ownedCat(userId, catId);
    const cat = await this.prisma.cat.update({
      where: { id: catId },
      data: { lostModeAt: enabled ? new Date() : null },
      select: { id: true, lostModeAt: true, qrToken: true },
    });
    this.events.emit("lost_mode_toggled", { userId, catId, props: { enabled } });
    return { id: cat.id, lostModeAt: cat.lostModeAt, qrToken: cat.qrToken };
  }

  /** One primary emergency contact per cat; setting it again replaces it. */
  async upsertEmergencyContact(userId: string, catId: string, dto: EmergencyContactDto) {
    await this.ownedCat(userId, catId);
    const existing = await this.prisma.catEmergencyContact.findFirst({ where: { catId, isPrimary: true }, select: { id: true } });
    const data = { name: dto.name.trim(), phone: dto.phone.trim(), relation: dto.relation ?? null, isPrimary: true };
    const contact = existing
      ? await this.prisma.catEmergencyContact.update({ where: { id: existing.id }, data })
      : await this.prisma.catEmergencyContact.create({ data: { catId, kind: "SECONDARY", ...data } });
    this.events.emit("cat_updated", { userId, catId, props: { surface: "emergency_contact" } });
    return { name: contact.name, phone: contact.phone, relation: contact.relation };
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

  // ── Photos (profile, cover, gallery) ────────────────────────────────────────

  /** Validate + store an image, returning its public URL + object key. */
  private async storeImage(file: UploadedImage | undefined, prefix: string) {
    if (!file || !file.buffer?.length) throw new BadRequestException("No image provided");
    if (file.size > MAX_IMAGE_BYTES) {
      throw new PayloadTooLargeException("Image must be 8 MB or smaller");
    }
    // Verify the REAL bytes, not the client-declared mimetype — blocks a polyglot
    // / SVG / HTML payload mislabeled as an image. The sniffed type is canonical.
    const ext = this.storage.sniffImageExt(file.buffer);
    if (!ext) throw new BadRequestException("Only real JPEG, PNG, or WebP images are allowed");
    const contentType = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";
    const key = this.storage.buildKey(prefix, ext);
    const url = await this.storage.upload(key, file.buffer, contentType);
    return { url };
  }

  async setProfilePhoto(userId: string, catId: string, file?: UploadedImage) {
    await this.ownedCat(userId, catId);
    const prev = await this.prisma.cat.findUnique({ where: { id: catId }, select: { photoUrl: true } });
    const { url } = await this.storeImage(file, `cats/${catId}/profile`);
    await this.prisma.cat.update({ where: { id: catId }, data: { photoUrl: url } });
    if (prev?.photoUrl) void this.storage.remove(prev.photoUrl);
    return { photoUrl: url };
  }

  async setCoverPhoto(userId: string, catId: string, file?: UploadedImage) {
    await this.ownedCat(userId, catId);
    const prev = await this.prisma.cat.findUnique({ where: { id: catId }, select: { coverUrl: true } });
    const { url } = await this.storeImage(file, `cats/${catId}/cover`);
    await this.prisma.cat.update({ where: { id: catId }, data: { coverUrl: url } });
    if (prev?.coverUrl) void this.storage.remove(prev.coverUrl);
    return { coverUrl: url };
  }

  async listGallery(userId: string, catId: string) {
    await this.ownedCat(userId, catId);
    return this.prisma.catPhoto.findMany({
      where: { catId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async addGalleryPhoto(userId: string, catId: string, file?: UploadedImage) {
    await this.ownedCat(userId, catId);
    const count = await this.prisma.catPhoto.count({ where: { catId } });
    if (count >= MAX_GALLERY_PHOTOS) {
      throw new BadRequestException(`A cat can have at most ${MAX_GALLERY_PHOTOS} gallery photos`);
    }
    const { url } = await this.storeImage(file, `cats/${catId}/gallery`);
    return this.prisma.catPhoto.create({
      data: { catId, url, sortOrder: count },
    });
  }

  async removeGalleryPhoto(userId: string, catId: string, photoId: string) {
    await this.ownedCat(userId, catId);
    const photo = await this.prisma.catPhoto.findFirst({ where: { id: photoId, catId } });
    if (!photo) throw new NotFoundException("Photo not found");
    await this.prisma.catPhoto.delete({ where: { id: photo.id } });
    void this.storage.remove(photo.url);
    return { success: true };
  }

  // ── Community visibility & privacy ──────────────────────────────────────────

  private static readonly VISIBILITY_SELECT = {
    isPublic: true,
    publicSlug: true,
    bio: true,
    showOwnerName: true,
    showCity: true,
    showGallery: true,
    showAge: true,
    showBreed: true,
    viewCount: true,
    isFeatured: true,
    sharedAt: true,
    shareConsentAt: true,
  } as const;

  async getVisibility(userId: string, catId: string) {
    await this.ownedCat(userId, catId);
    // The owner's public handle lives on the User (one identity across all
    // their cats) — surfaced here so the panel can edit it in place.
    const [cat, user] = await Promise.all([
      this.prisma.cat.findUnique({
        where: { id: catId },
        select: CatsService.VISIBILITY_SELECT,
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { ownerNickname: true },
      }),
    ]);
    return cat ? { ...cat, ownerNickname: user?.ownerNickname ?? null } : cat;
  }

  async updateVisibility(userId: string, catId: string, dto: UpdateVisibilityDto) {
    await this.ownedCat(userId, catId);
    const current = await this.prisma.cat.findUnique({
      where: { id: catId },
      select: { name: true, publicSlug: true, isPublic: true },
    });

    const data: Record<string, unknown> = {};
    for (const k of ["showOwnerName", "showCity", "showGallery", "showAge", "showBreed"] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.bio !== undefined) data.bio = dto.bio.trim() || null;

    // PDPL photo-consent attestation (R106): the client only ever says "the
    // owner confirmed" — the timestamp is minted here, never trusted from input.
    if (dto.consent === true) data.shareConsentAt = new Date();

    // The owner's public display name (share-time identity fork, D6). Stored on
    // the User so one handle follows them across every cat; "" clears it.
    let ownerNickname: string | null | undefined;
    if (dto.ownerNickname !== undefined) {
      ownerNickname = dto.ownerNickname.trim() || null;
      await this.prisma.user.update({ where: { id: userId }, data: { ownerNickname } });
    }

    let newlyPublic = false;
    if (dto.isPublic !== undefined) {
      data.isPublic = dto.isPublic;
      if (dto.isPublic) {
        newlyPublic = !current?.isPublic;
        data.sharedAt = new Date();
        // Mint a stable public slug on first share; keep it thereafter.
        if (!current?.publicSlug) data.publicSlug = await this.makePublicSlug(current?.name ?? "cat");
      }
    }

    const updated = await this.prisma.cat.update({
      where: { id: catId },
      data,
      select: CatsService.VISIBILITY_SELECT,
    });

    // Confirm the share in-app the moment it happens (a public action deserves a
    // receipt — R024 spirit), with the link to the live profile.
    if (newlyPublic) {
      this.notifications.emit(userId, {
        category: "COMMUNITY",
        type: "cat_made_public",
        params: { name: current?.name ?? "Your cat" },
        data: { kind: "cat_made_public", slug: updated.publicSlug },
      });
    }

    // Keep the response shape identical to getVisibility so client caches
    // written from either stay aligned.
    if (ownerNickname === undefined) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { ownerNickname: true },
      });
      ownerNickname = user?.ownerNickname ?? null;
    }
    return { ...updated, ownerNickname };
  }

  /** Stable, URL-safe public handle: latinized name + short random suffix. */
  private async makePublicSlug(name: string): Promise<string> {
    const base =
      name
        .normalize("NFKD")
        .replace(/[^\x20-\x7E]/g, "") // drop non-ASCII (e.g. Arabic)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24) || "cat";
    // Random suffix makes collisions astronomically unlikely; retry to be safe.
    for (let i = 0; i < 5; i++) {
      const slug = `${base}-${randomBytes(3).toString("hex")}`;
      const clash = await this.prisma.cat.findUnique({ where: { publicSlug: slug }, select: { id: true } });
      if (!clash) return slug;
    }
    return `cat-${randomBytes(6).toString("hex")}`;
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

  private serialize(cat: CatRow, primaryCatId: string | null) {
    return {
      id: cat.id,
      name: cat.name,
      catIdNumber: cat.catIdNumber,
      // The census ordinal + the founding badge it implies. `isFoundingMember`
      // is a restatement of the number, never an independent flag — see
      // packages/core/src/census.ts for why that matters (R006).
      catNumber: cat.catNumber,
      isFoundingMember: isFoundingMember(cat.catNumber),
      cityCode: cat.cityCode,
      // The founding class, pre-composed in both languages so the card, the
      // ceremony and any export all say the same thing. Built from the cat's
      // OWN city and issue year — null city yields a class with no city in it
      // rather than a guess (R040). Null entirely when not a founding member.
      foundingClass: {
        ar: foundingClassLabel(cat.catNumber, saudiCityLabel(cat.cityCode, "ar"), cat.idIssuedAt, "ar"),
        en: foundingClassLabel(cat.catNumber, saudiCityLabel(cat.cityCode, "en"), cat.idIssuedAt, "en"),
      },
      // The QR token is the owner's own secret for their card — safe to return to
      // the authenticated owner; partners resolve it via /verify, never the URL.
      qrToken: cat.qrToken,
      idIssuedAt: cat.idIssuedAt,
      photoUrl: cat.photoUrl,
      coverUrl: cat.coverUrl,
      // Community visibility state — the wizard/ceremony reflect the default-share
      // outcome (and link to /community/:slug) without a second fetch.
      isPublic: cat.isPublic,
      publicSlug: cat.publicSlug,
      gender: cat.gender,
      birthDate: cat.birthDate,
      // On-card health signal (§05 job 2) — the ID shows vaccination standing.
      vaccinationStatus: cat.vaccinationStatus,
      weightKg: cat.weightKg,
      lifeStage: cat.lifeStage,
      activityLevel: cat.activityLevel,
      isIndoor: cat.isIndoor,
      status: cat.status,
      membershipStatus: cat.membershipStatus,
      archivedAt: cat.archivedAt,
      deceasedAt: cat.deceasedAt,
      microchipNo: cat.microchipNo,
      lostModeAt: cat.lostModeAt,
      coatColor: cat.coatColor,
      isNeutered: cat.isNeutered,
      currentMedications: cat.currentMedications,
      emergencyNotes: cat.emergencyNotes,
      diet: cat.diet,
      vetNotes: cat.vetNotes,
      favoriteFoods: cat.favoriteFoods,
      preferredBrand: cat.preferredBrand,
      // Owner health profile (T3) — edited on the cat's health page.
      currentFood: cat.currentFood,
      acquisitionSource: cat.acquisitionSource,
      district: cat.district,
      homeBranchId: cat.homeBranchId,
      // The character & keepsake layer (personality/favourites/fun +
      // personalisation) — powers the profile journey and the personalised card.
      profile: (cat.profile ?? null) as Record<string, unknown> | null,
      isPrimary: cat.id === primaryCatId,
      breed: cat.breed ?? null,
      // Flat string arrays so the web never has to reach into row objects
      // (the "[object Object]" prefill bug). Full objects stay on GET /cats/:id
      // via the health panel; these power the card + the complete-file form.
      healthConds: cat.healthConds ?? [],
      allergies: cat.allergies ?? [],
      allergyNames: (cat.allergies ?? []).map((a) => a.allergen),
      healthConditionNames: (cat.healthConds ?? []).map((h) => h.name),
    };
  }
}
