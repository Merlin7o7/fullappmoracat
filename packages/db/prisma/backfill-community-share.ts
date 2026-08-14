/**
 * One-time backfill: community visibility opt-in → opt-out (decision 2026-08-14).
 *
 * Publishes every eligible existing cat to the community, mirroring what
 * CatsService.create() now does for new registrations. Run ONCE, immediately
 * after the opt-out release deploys — the eligibility filter (`isPublic: false`)
 * cannot distinguish a cat that was never published from one whose owner just
 * opted out, so a later run would override fresh opt-outs.
 *
 * What it does per eligible cat:
 *   - isPublic: true
 *   - sharedAt: the cat's createdAt (an honest tenure fact: "in the community
 *     since they registered" — also keeps the "New" feed sort meaningful and
 *     the founding chip truthful, instead of collapsing hundreds of cats onto
 *     one backfill timestamp)
 *   - publicSlug: minted with the same latinize + random-suffix algorithm as
 *     CatsService.makePublicSlug, with collision retry
 *   - shareConsentAt: NEVER touched — no PDPL people-in-photo attestation
 *     happened for these photos (founder-accepted exposure, recorded in the
 *     DESIGN-AUTHORITY amendment); the manage panel still asks once if the
 *     owner ever toggles off → on
 *
 * Eligibility deliberately ignores:
 *   - photoUrl: photo-less cats are published too; the community read model's
 *     photo rule keeps them invisible until a photo lands, at which point they
 *     appear automatically
 *   - hiddenAt: a moderation-hidden cat regains isPublic but stays invisible
 *     through the `hiddenAt: null` read filter — moderation decisions survive
 *
 * Each owner gets ONE grouped in-app notification (not one per cat) naming the
 * off switch — the disclosure that makes a default a choice.
 *
 * Usage:
 *   DRY_RUN=1 DATABASE_URL=<url> pnpm db:backfill:community-share   # counts only
 *   DATABASE_URL=<url> pnpm db:backfill:community-share             # real run
 */
import { randomBytes } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1";
const BATCH = 200;

/** Same algorithm as CatsService.makePublicSlug (apps/api/src/cats/cats.service.ts). */
async function mintPublicSlug(name: string): Promise<string> {
  const base =
    name
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "") // drop non-ASCII (e.g. Arabic)
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

const ELIGIBLE: Prisma.CatWhereInput = {
  isPublic: false,
  deletedAt: null,
  status: "ACTIVE",
  isDemo: false,
  user: { is: { status: "ACTIVE", deletedAt: null } },
};

async function main() {
  const eligible = await prisma.cat.count({ where: ELIGIBLE });
  const withPhoto = await prisma.cat.count({ where: { ...ELIGIBLE, photoUrl: { not: null } } });
  console.log(
    `Eligible: ${eligible} cat(s) (${withPhoto} with a photo → visible immediately; ` +
      `${eligible - withPhoto} photo-less → appear once a photo is added).${DRY_RUN ? " [DRY RUN]" : ""}`
  );

  if (DRY_RUN) {
    const sample = await prisma.cat.findMany({
      where: ELIGIBLE,
      take: 5,
      select: { name: true, createdAt: true, photoUrl: true, userId: true },
    });
    for (const c of sample) {
      console.log(`  sample: ${c.name} (registered ${c.createdAt.toISOString().slice(0, 10)}, photo: ${c.photoUrl ? "yes" : "no"})`);
    }
    return;
  }

  let updated = 0;
  let failed = 0;
  const owners = new Map<string, number>(); // userId → published-cat count

  // Cursor over a stable snapshot of ids first: each update flips isPublic and
  // would otherwise shift a `where isPublic:false` page under the cursor.
  for (;;) {
    const page = await prisma.cat.findMany({
      where: ELIGIBLE,
      take: BATCH,
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, createdAt: true, userId: true, publicSlug: true },
    });
    if (page.length === 0) break;

    for (const cat of page) {
      try {
        const data: Prisma.CatUpdateInput = {
          isPublic: true,
          sharedAt: cat.createdAt,
          ...(cat.publicSlug ? {} : { publicSlug: await mintPublicSlug(cat.name) }),
        };
        try {
          await prisma.cat.update({ where: { id: cat.id }, data });
        } catch (err) {
          // Unique-violation on the slug (concurrent mint) → re-mint once.
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            await prisma.cat.update({
              where: { id: cat.id },
              data: { ...data, publicSlug: await mintPublicSlug(cat.name) },
            });
          } else {
            throw err;
          }
        }
        updated += 1;
        owners.set(cat.userId, (owners.get(cat.userId) ?? 0) + 1);
      } catch (err) {
        failed += 1;
        console.warn(`  ! skipped ${cat.name} (${cat.id}): ${(err as Error).message}`);
      }
    }
    console.log(`  …${updated} published so far`);
  }

  // One grouped notification per owner — the publish receipt that names the off
  // switch. Shape mirrors NotificationsService.notify (title/body = en fallback,
  // data.i18n renders per-locale in the web feed).
  const notifications = [...owners.entries()].map(([userId, count]) => {
    const i18n = {
      ar: {
        title: count === 1 ? "قطك الآن في مجتمع مرقط" : "قططك الآن في مجتمع مرقط",
        body: "صار ملف قطك العام ظاهراً لمجتمع مرقط — بدون اسمك. تقدر تخفيه في أي وقت من إعدادات القط.",
      },
      en: {
        title: count === 1 ? "Your cat is now in the Moracat community" : "Your cats are now in the Moracat community",
        body: "Your cat's public profile is now visible to the community — your name is not shown. You can turn this off anytime from the cat's settings.",
      },
    };
    return {
      userId,
      channel: "IN_APP" as const,
      category: "COMMUNITY" as const,
      title: i18n.en.title,
      body: i18n.en.body,
      data: { type: "cat_made_public", kind: "cat_made_public", params: {}, i18n, backfill: true } as Prisma.InputJsonValue,
    };
  });
  if (notifications.length > 0) {
    await prisma.notification.createMany({ data: notifications });
  }

  console.log(
    `Done. Published ${updated} cat(s) across ${owners.size} owner(s), ` +
      `${notifications.length} notification(s), ${failed} failure(s).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
