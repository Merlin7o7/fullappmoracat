/**
 * Founding-cats community seed.
 *
 * HONESTY RULE (R006): every cat in the manifest must be a REAL cat — the
 * team's own cats or friends' cats shared with their explicit okay. Never seed
 * invented cats or stock photos to make the community look busier than it is;
 * an honest small community beats a fake big one. Photo consent (PDPL, R106):
 * by listing a photo here the founder attests that any people visible in it
 * agreed to its publication — `shareConsentAt` is stamped accordingly.
 *
 * The manifest `prisma/community-seed.json` ships EMPTY. Fill it with entries
 * shaped like this (all fields except `name` optional):
 *
 *   [
 *     {
 *       "name": "Mishmish",
 *       "nameAr": "مشمش",              // preferred display name (Arabic-first, R101)
 *       "breed": "Arabian Mau",        // matched against Breed.nameEn or nameAr
 *       "city": "jeddah",              // informational — see the note on cities below
 *       "photoPath": "https://…/mishmish.jpg", // stored as the cat's photo URL
 *       "ownerNickname": "أم مشمش"     // shown as "with …" on the public profile
 *     }
 *   ]
 *
 * Note on cities: the community read model derives a cat's city from the OWNER's
 * default address (privacy: the cat never carries an address). A `city` value
 * here is logged as a reminder to set the founder account's default address —
 * it is not written anywhere.
 *
 * Usage (local dev DB running via `pnpm db:local`):
 *   FOUNDER_EMAIL=founder@moracat.co pnpm db:seed:community
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FoundingCatEntry {
  name: string;
  nameAr?: string;
  breed?: string;
  city?: string;
  photoPath?: string;
  ownerNickname?: string;
}

/** Same unambiguous alphabet as the API's IdsService (no 0/O/1/I/L). */
const ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function pick(n: number): string {
  return Array.from({ length: n }, () => ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]).join("");
}

/** Mint a unique Cat ID (MRC-XXXX-XXXX), mirroring the API's format. */
async function newCatId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = `MRC-${pick(4)}-${pick(4)}`;
    const clash = await prisma.cat.findUnique({ where: { catIdNumber: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  throw new Error("Could not mint a unique Cat ID");
}

/** Mint a unique public slug (latinized name + short random suffix), like CatsService. */
async function newPublicSlug(name: string): Promise<string> {
  const base =
    name
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "cat";
  for (let i = 0; i < 5; i++) {
    const slug = `${base}-${randomBytes(3).toString("hex")}`;
    const clash = await prisma.cat.findUnique({ where: { publicSlug: slug }, select: { id: true } });
    if (!clash) return slug;
  }
  return `cat-${randomBytes(6).toString("hex")}`;
}

/** Arabic-aware search fold — a copy of the API's normalizeName (common/text.ts). */
function normalizeName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .replace(/ـ/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ء")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const founderEmail = process.env.FOUNDER_EMAIL;
  if (!founderEmail) {
    console.error("❌ Set FOUNDER_EMAIL to the account that will own the founding cats.");
    process.exit(1);
  }

  const manifestPath = join(__dirname, "community-seed.json");
  const entries = JSON.parse(readFileSync(manifestPath, "utf8")) as FoundingCatEntry[];
  if (!Array.isArray(entries)) {
    console.error("❌ community-seed.json must be a JSON array — see the header comment for the shape.");
    process.exit(1);
  }
  if (entries.length === 0) {
    console.log("ℹ  community-seed.json is empty — add real founding cats first (see header comment).");
    return;
  }

  const founder = await prisma.user.findUnique({
    where: { email: founderEmail.toLowerCase() },
    select: { id: true, ownerNickname: true, addresses: { where: { isDefault: true }, take: 1, select: { id: true } } },
  });
  if (!founder) {
    console.error(`❌ No account found for FOUNDER_EMAIL=${founderEmail} — register it first.`);
    process.exit(1);
  }

  console.log(`🐈 Seeding ${entries.length} founding cat(s) for ${founderEmail}…`);

  for (const entry of entries) {
    const displayName = entry.nameAr?.trim() || entry.name.trim();
    if (!displayName) continue;

    // Idempotent: skip cats the founder already has by this name.
    const existing = await prisma.cat.findFirst({
      where: { userId: founder.id, name: displayName, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      console.log(`  ↷ ${displayName} already exists — skipped`);
      continue;
    }

    let breedId: string | null = null;
    if (entry.breed) {
      const breed = await prisma.breed.findFirst({
        where: { OR: [{ nameEn: { equals: entry.breed, mode: "insensitive" } }, { nameAr: entry.breed }] },
        select: { id: true },
      });
      breedId = breed?.id ?? null;
      if (!breed) console.warn(`  ⚠ breed "${entry.breed}" not found for ${displayName} — left unset`);
    }

    if (entry.city && founder.addresses.length === 0) {
      console.warn(
        `  ⚠ ${displayName} lists city "${entry.city}", but city display comes from the founder's ` +
          "default address — set one on the account for it to show."
      );
    }

    // "with …" on the public profile — only if a nickname was explicitly provided.
    if (entry.ownerNickname && !founder.ownerNickname) {
      await prisma.user.update({ where: { id: founder.id }, data: { ownerNickname: entry.ownerNickname } });
      founder.ownerNickname = entry.ownerNickname;
    }

    const now = new Date();
    const cat = await prisma.cat.create({
      data: {
        userId: founder.id,
        name: displayName,
        nameNormalized: normalizeName(displayName),
        catIdNumber: await newCatId(),
        idIssuedAt: now,
        photoUrl: entry.photoPath ?? null,
        breedId,
        // Public from the start — that's the point of a founding cat. Consent is
        // attested by the founder when assembling the manifest (see header).
        isPublic: true,
        publicSlug: await newPublicSlug(entry.name),
        sharedAt: now,
        shareConsentAt: now,
        showBreed: true,
        showOwnerName: Boolean(entry.ownerNickname),
      },
      select: { publicSlug: true },
    });
    console.log(`  ✓ ${displayName} → /community/${cat.publicSlug}`);
  }

  console.log("✅ Founding cats seeded.");
}

main()
  .catch((err) => {
    console.error("❌ Community seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
