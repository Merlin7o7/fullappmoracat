import { Injectable } from "@nestjs/common";
import { FOUNDING_MEMBER_LIMIT } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";

/**
 * The Census — how many cats are registered, right now, for real.
 *
 * Phase 0 (MRC-GTM-001 §1) is a counting campaign: «التعداد الوطني للقطط».
 * The number on the front page is the product's first honesty test, so this
 * service has exactly one rule — **it reports what the database says**. It
 * never rounds up, never seeds a floor ("1,000+ cats!"), never estimates, and
 * never projects. If the true count is 7, the site says 7 (R040 — never claim
 * what the product doesn't do; R006 — no manufactured scarcity or scale).
 *
 * Note what is absent: any "spots remaining" figure. Remaining-founding-places
 * is a scarcity clock and we do not ship scarcity clocks. We publish the real
 * count and the real cohort size and let the reader subtract.
 */

/**
 * How long a count may be reused before we ask Postgres again.
 *
 * The counter is on the homepage, which is dynamically rendered (the locale
 * cookie forces it), so this would otherwise be one `COUNT(*)` per visit. 30s
 * of staleness is invisible to a human watching a number that moves a few times
 * an hour, and it keeps a viral moment from turning the hero into a load test.
 * Matches the `s-maxage=30` on the wire so the two layers agree.
 */
const COUNT_TTL_MS = 30_000;

interface CensusSnapshot {
  /** Cats registered and not deleted. The census number. */
  registered: number;
  /** The founding cohort size — 1,000 (packages/core). */
  foundingLimit: number;
  /**
   * Whether every founding place has now been issued. Derived from the highest
   * ordinal ever assigned, NOT from `registered` — a founding member who later
   * deletes their cat does not reopen their place for someone else.
   */
  foundingClosed: boolean;
  /**
   * The most recently registered cat that its owner chose to make public —
   * the "Cat #347 is Lulu" beat from §1, and the stand's e-paper line (§2).
   * Private cats are never named here; consent is the whole gate (R106).
   */
  latestPublicCatName: string | null;
  /** Ordinal of that cat, so the site can say "#347" beside the name. */
  latestPublicCatNumber: number | null;
}

@Injectable()
export class CensusService {
  constructor(private readonly prisma: PrismaService) {}

  private cached: { at: number; snapshot: CensusSnapshot } | null = null;
  /** In-flight read, so a cold cache under load makes one query, not N. */
  private inFlight: Promise<CensusSnapshot> | null = null;

  async snapshot(): Promise<CensusSnapshot> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < COUNT_TTL_MS) return this.cached.snapshot;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.read()
      .then((snapshot) => {
        this.cached = { at: Date.now(), snapshot };
        return snapshot;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private async read(): Promise<CensusSnapshot> {
    const [registered, highest, latestPublic] = await Promise.all([
      // Soft-deleted cats leave the count: they are no longer registered. Their
      // ordinal is NOT recycled, which is why `foundingClosed` reads the high
      // water mark separately instead of comparing against this number.
      // isDemo excluded: the census ordinal IS the founding-member campaign, so
      // a fictional cat inside it is a false public claim (R006).
      this.prisma.cat.count({ where: { deletedAt: null, isDemo: false } }),
      this.prisma.cat.aggregate({ _max: { catNumber: true }, where: { isDemo: false } }),
      // Only cats whose owner opted into the public community, and that a
      // moderator hasn't hidden. Everything else is private by default.
      this.prisma.cat.findFirst({
        where: { deletedAt: null, isPublic: true, hiddenAt: null, isDemo: false },
        orderBy: { catNumber: "desc" },
        select: { name: true, catNumber: true },
      }),
    ]);

    return {
      registered,
      foundingLimit: FOUNDING_MEMBER_LIMIT,
      foundingClosed: (highest._max.catNumber ?? 0) >= FOUNDING_MEMBER_LIMIT,
      latestPublicCatName: latestPublic?.name ?? null,
      latestPublicCatNumber: latestPublic?.catNumber ?? null,
    };
  }
}
