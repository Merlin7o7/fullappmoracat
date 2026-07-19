/**
 * The public clinic directory — one shape, one parser, two consumers.
 *
 * The API returns one row per BRANCH, wrapped in `{ items, pagination }`, with
 * the clinic nested as `org` and the city as an object. The member-facing
 * screens want a flat, already-localised row. That translation lived nowhere,
 * so each consumer invented its own guess and both were wrong — the public
 * directory read the envelope as a bare array, and the consent picker showed
 * nothing at all. It lives here now, and both import it.
 *
 * Pure and React-free on purpose: the public directory page is a server
 * component and the consent picker is a client component, so this module has to
 * be importable from either side.
 */

/** A directory row as the member-facing screens consume it. */
export interface DirectoryClinic {
  /** Consent is granted to the ORG, never a single branch — this is the key. */
  orgId: string;
  branchId: string;
  /** The clinic's name (the org). What a member recognises. */
  nameEn: string;
  nameAr: string;
  /** The branch, when a clinic has more than one worth naming. */
  branchEn: string | null;
  branchAr: string | null;
  city: string | null;
  addressLine: string | null;
  phone: string | null;
  mapsUrl: string | null;
  emergency24h: boolean;
  specialties: string[];
  services: string[];
  photos: string[];
  verified: boolean;
  tier: string | null;
}

/** The API's branch row, as actually served by GET /vet/directory. */
interface ApiDirectoryBranch {
  id?: string;
  nameEn?: string | null;
  nameAr?: string | null;
  addressLine?: string | null;
  phone?: string | null;
  mapsUrl?: string | null;
  emergency24h?: boolean | null;
  specialties?: string[] | null;
  services?: string[] | null;
  photos?: string[] | null;
  verified?: boolean | null;
  city?: { nameEn?: string | null; nameAr?: string | null } | string | null;
  org?: {
    id?: string;
    nameEn?: string | null;
    nameAr?: string | null;
    tier?: string | null;
  } | null;
}

function cityName(city: ApiDirectoryBranch["city"], isAr: boolean): string | null {
  if (!city) return null;
  if (typeof city === "string") return city || null;
  return (isAr ? city.nameAr : city.nameEn) || city.nameEn || city.nameAr || null;
}

/**
 * Normalise whatever the directory endpoint returned into flat rows.
 * Accepts the `{ items }` envelope, a `{ clinics }` envelope, or a bare array,
 * so a future response-shape change degrades to "empty list" rather than a
 * thrown render.
 */
export function normalizeDirectory(raw: unknown, isAr = true): DirectoryClinic[] {
  const rows: ApiDirectoryBranch[] = Array.isArray(raw)
    ? (raw as ApiDirectoryBranch[])
    : ((raw as { items?: ApiDirectoryBranch[]; clinics?: ApiDirectoryBranch[] } | null)?.items ??
       (raw as { clinics?: ApiDirectoryBranch[] } | null)?.clinics ??
       []);

  return rows
    .filter((b) => b?.org?.id)
    .map((b) => ({
      orgId: b.org!.id!,
      branchId: b.id ?? "",
      // The ORG is the clinic a member is choosing to trust; the branch name is
      // secondary detail (and is often just "Main branch").
      nameEn: b.org!.nameEn || b.nameEn || "",
      nameAr: b.org!.nameAr || b.nameAr || "",
      branchEn: b.nameEn ?? null,
      branchAr: b.nameAr ?? null,
      city: cityName(b.city, isAr),
      addressLine: b.addressLine ?? null,
      phone: b.phone ?? null,
      mapsUrl: b.mapsUrl ?? null,
      emergency24h: !!b.emergency24h,
      specialties: b.specialties ?? [],
      services: b.services ?? [],
      photos: b.photos ?? [],
      verified: !!b.verified,
      tier: b.org!.tier ?? null,
    }));
}

/**
 * One row per clinic, for surfaces where the unit of choice is the ORG —
 * consent above all. Granting access to a clinic grants it across that
 * clinic's branches, so listing each branch separately would offer the member
 * the same decision several times and imply a distinction that doesn't exist.
 */
export function dedupeByOrg(rows: DirectoryClinic[]): DirectoryClinic[] {
  const seen = new Map<string, DirectoryClinic>();
  for (const row of rows) {
    const existing = seen.get(row.orgId);
    // Prefer the row that carries the most useful detail (a city, a phone).
    if (!existing || (!existing.city && row.city) || (!existing.phone && row.phone)) {
      seen.set(row.orgId, row);
    }
  }
  return [...seen.values()];
}
