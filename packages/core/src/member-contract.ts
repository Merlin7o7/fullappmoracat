/**
 * The member-facing API contract — shared verbatim by the NestJS services, the
 * web portal and the iOS app.
 *
 * Same discipline as `vet-contract.ts`, and for the same reason. The clinic
 * portal once drifted from the API on enum values and envelope shapes, and
 * because the fetch helper cast responses without validating them nothing
 * threw — screens just rendered blank. The fix was to make both sides import
 * one declaration so a change breaks the build instead of the clinic.
 *
 * With a second client (iOS) reading the same endpoints, that risk doubles:
 * two hand-maintained copies of `AdoptionListing` will disagree, and the
 * disagreement will surface as an empty screen on a phone in someone's hand.
 * So the read models live here, once.
 *
 * The bilingual label helpers live here too, deliberately. The fixed lexicon
 * (R087 — **member**, **Cat ID**, **benefit**) is a design rule, and a rule
 * enforced by one function cannot drift between a browser and a phone.
 *
 * PRIVACY NOTE FOR ANYONE EXTENDING THESE TYPES: the API deliberately never
 * sends an owner's email, phone or address on a public read. If you find
 * yourself adding such a field, the bug is on the server.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Shared primitives
 * ──────────────────────────────────────────────────────────────────────────*/

export interface CityLabel {
  code: string;
  ar: string | null;
  en: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/** A name the API sends in both languages. */
export interface LocalizedName {
  nameEn: string;
  nameAr: string;
}

/** A short bilingual pair (the adoption/lost-found breed shape). */
export interface BilingualPair {
  ar: string;
  en: string;
}

/** How a listing owner or reporter chose to be reached. */
export type ContactPref = "IN_APP" | "PHONE" | "WHATSAPP" | "EMAIL";

/** Pick a city's label for the current locale, falling back to the other. */
export function cityLabel(city: CityLabel | null | undefined, isAr: boolean): string | null {
  if (!city) return null;
  return (isAr ? city.ar : city.en) ?? city.en ?? city.ar;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cats — the Cat ID and the profile behind it
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * A cat's sex. `UNKNOWN` is a legitimate answer a rescuer chooses, not a
 * default nobody looked at — which is why it is distinct from the account
 * owner's `UNSPECIFIED` below. Mirrors the Prisma `CatGender` enum.
 */
export type CatGenderValue = "MALE" | "FEMALE" | "UNKNOWN";

/** The account owner's gender — it drives the warm Najdi greeting (يبو / أم). */
export type OwnerGenderValue = "MALE" | "FEMALE" | "UNSPECIFIED";

export type CatStatusValue = "ACTIVE" | "ARCHIVED" | "DECEASED";

/** Mirrors the Prisma `LifeStage` enum — three stages, not six. */
export type LifeStageValue = "KITTEN" | "ADULT" | "SENIOR";

export type ActivityLevelValue = "LOW" | "MODERATE" | "HIGH";

/** Standing derived from the records, never stored as a claim. */
export type VaccinationStatusValue = "UP_TO_DATE" | "PARTIAL" | "NONE" | "UNKNOWN";

/** The lightweight cat as it appears in a roster or a rail. */
export interface CatSummary {
  id: string;
  name: string;
  catIdNumber: string | null;
  photoUrl: string | null;
  status: CatStatusValue;
  membershipStatus: string;
  likeCount: number;
  isPrimary?: boolean;
}

/**
 * The full cat, exactly as `CatsService.serialize()` emits it.
 *
 * `foundingClass` arrives pre-composed in both languages because it is built
 * from the cat's OWN city and issue year — a client must never assemble it
 * from parts and guess (R006/R040).
 */
export interface CatDetail {
  id: string;
  name: string;
  catIdNumber: string | null;
  /** This cat's place in the national census. */
  catNumber: number;
  isFoundingMember: boolean;
  cityCode: string | null;
  foundingClass: { ar: string | null; en: string | null };
  /** The owner's own secret for their card — resolved via /verify by others. */
  qrToken: string | null;
  idIssuedAt: string | null;
  photoUrl: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  publicSlug: string | null;
  gender: CatGenderValue;
  birthDate: string | null;
  vaccinationStatus: VaccinationStatusValue | null;
  weightKg: number | null;
  lifeStage: LifeStageValue | null;
  activityLevel: ActivityLevelValue;
  isIndoor: boolean;
  status: CatStatusValue;
  membershipStatus: string;
  archivedAt: string | null;
  deceasedAt: string | null;
  microchipNo: string | null;
  lostModeAt: string | null;
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
  profile: Record<string, unknown> | null;
  isPrimary: boolean;
  breed: LocalizedName | null;
}

export interface CatVaccination {
  id: string;
  name: string;
  givenAt: string | null;
  dueAt: string | null;
  vetName: string | null;
  batchNo: string | null;
  notes: string | null;
}

export interface CatVetVisit {
  id: string;
  reason: string | null;
  clinicName: string | null;
  visitedAt: string;
  diagnosis: string | null;
  treatment: string | null;
  costSar: number | null;
}

export interface CatDocument {
  id: string;
  kind: string;
  title: string | null;
  url: string | null;
  createdAt: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The member's home — `GET /account/overview`
 * ──────────────────────────────────────────────────────────────────────────*/

/** A forward glance at care that is coming, not care that is overdue. */
export interface ComingUpItem {
  type: "vaccination" | "delivery";
  at: string;
  catId: string | null;
  catName: string | null;
  label: string | null;
}

export interface AccountOverview {
  owner: {
    firstName: string | null;
    gender: OwnerGenderValue;
    memberSince: string | null;
    /** A deliberate way in, not an abandoned registration (R111). */
    noCatYet: boolean;
  };
  primaryCat: {
    id: string;
    name: string;
    catIdNumber: string | null;
    photoUrl: string | null;
    completion: { percent: number; missing: string[] } | null;
  } | null;
  cats: CatSummary[];
  activeSubscription: {
    id: string;
    plan: { nameEn: string; nameAr: string; tier: string };
    status: string;
    price: number;
    nextDeliveryAt: string | null;
    nextBillingAt: string | null;
  } | null;
  stats: {
    orders: number;
    cats: number;
    catCounts: { total: number; active: number; archived: number; deceased: number };
    walletBalance: number;
    totalSaved: number;
    loyaltyPoints: number;
    loyaltyTier: string;
    unreadNotifications: number;
    /** The beta value ledger — proof of accrued care, not money (R049). */
    healthRecords: number;
    photos: number;
    communityLikes: number;
  };
  comingUp: ComingUpItem[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Adoption
 * ──────────────────────────────────────────────────────────────────────────*/

export type AdoptionStatus = "AVAILABLE" | "RESERVED" | "ADOPTED" | "WITHDRAWN";
export type AdoptionRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "WITHDRAWN"
  | "COMPLETED";

export interface AdoptionCatCard {
  id: string;
  name: string;
  photoUrl: string | null;
  gender: string;
  birthDate: string | null;
  ageMonths: number | null;
  lifeStage: string | null;
  /** The identity that travels with them — proof, not a claim. */
  catIdNumber: string | null;
  vaccinationStatus: string | null;
  breed: BilingualPair | null;
}

export interface AdoptionCard {
  id: string;
  status: AdoptionStatus;
  city: CityLabel | null;
  feeSar: number;
  publishedAt: string;
  viewCount: number;
  cat: AdoptionCatCard;
}

export interface AdoptionListing extends AdoptionCard {
  story: string;
  reason: string | null;
  district: string | null;
  goodWith: { kids: boolean | null; cats: boolean | null; dogs: boolean | null };
  adoptedAt: string | null;
  owner: { name: string | null; memberSince: string };
  contactPref: ContactPref;
  /** Non-null only once the owner has accepted you. */
  contact: { pref: ContactPref; phone: string | null } | null;
  cat: AdoptionCatCard & {
    bio: string | null;
    coatColor: string | null;
    isNeutered: boolean | null;
    weightKg: number | null;
    isIndoor: boolean | null;
    publicSlug: string | null;
    registeredAt: string;
    photos: { id: string; url: string }[];
    vaccinationCount: number;
  };
  viewer: {
    isOwner: boolean;
    request: {
      id: string;
      status: AdoptionRequestStatus;
      message: string;
      ownerNote: string | null;
      createdAt: string;
    } | null;
  };
  requestCount?: number;
}

export interface AdoptionListResponse {
  items: AdoptionCard[];
  pagination: Pagination;
}

export interface AdoptionFacets {
  cities: (CityLabel & { count: number })[];
  total: number;
}

export interface MyAdoption {
  listings: (AdoptionCard & { story: string; pendingRequests: number })[];
  requests: {
    id: string;
    status: AdoptionRequestStatus;
    message: string;
    ownerNote: string | null;
    createdAt: string;
    decidedAt: string | null;
    listing: AdoptionCard;
  }[];
}

export interface AdoptionEnquiry {
  id: string;
  status: AdoptionRequestStatus;
  message: string;
  ownerNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  requester: {
    name: string | null;
    memberSince: string;
    catsRegistered: number;
    /** Released only once this person has been accepted. */
    email: string | null;
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Lost & Found
 * ──────────────────────────────────────────────────────────────────────────*/

export type LostFoundKind = "LOST" | "FOUND";
export type LostFoundStatus = "ACTIVE" | "REUNITED" | "CLOSED";

export interface LostFoundCard {
  id: string;
  kind: LostFoundKind;
  status: LostFoundStatus;
  catName: string | null;
  photoUrl: string | null;
  city: CityLabel | null;
  district: string | null;
  gender: string;
  happenedAt: string;
  viewCount: number;
  /** Backed by a real Cat ID — what separates this from a notice board. */
  registered: boolean;
}

export interface LostFoundPost extends LostFoundCard {
  description: string;
  areaNote: string | null;
  colorNote: string | null;
  hasCollar: boolean | null;
  /** `value` is non-null only for the reporter themselves. */
  microchip: { onFile: true; value: string | null } | null;
  photos: string[];
  createdAt: string;
  reunitedAt: string | null;
  registeredCat: {
    catIdNumber: string | null;
    breed: BilingualPair | null;
    publicSlug: string | null;
  } | null;
  contact: { pref: ContactPref; phone: string | null; email: string | null };
  viewer: { isReporter: boolean };
  messageCount?: number;
}

export interface LostFoundListResponse {
  items: LostFoundCard[];
  pagination: Pagination;
}

export interface LostFoundFacets {
  lost: number;
  found: number;
  /** Earned, never estimated: notices the reporter actually marked reunited. */
  reunited: number;
  cities: (CityLabel & { count: number })[];
}

export interface LostFoundMessage {
  id: string;
  message: string;
  name: string | null;
  phone: string | null;
  createdAt: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Ownership transfer — the Cat ID changing hands
 * ──────────────────────────────────────────────────────────────────────────*/

export type TransferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
export type TransferReason = "ADOPTION" | "GIFT" | "REHOME" | "OTHER";

export interface TransferPreview {
  id: string;
  status: TransferStatus;
  /** Masked — enough to recognise your own address, useless to anyone else. */
  toEmailMasked: string;
  expiresAt: string;
  note: string | null;
  reason: TransferReason;
  fromName: string | null;
  cat: {
    id: string;
    name: string;
    photoUrl: string | null;
    catIdNumber: string | null;
    birthDate: string | null;
    gender: string;
    breed: BilingualPair | null;
    /** What the new owner inherits, in numbers. */
    history: { vaccinations: number; clinicalEntries: number; photos: number };
  };
}

export interface TransferCard {
  id: string;
  direction: "incoming" | "outgoing";
  status: TransferStatus;
  reason: TransferReason;
  note: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  fromListing: boolean;
  fromName: string | null;
  toEmail: string;
  cat: { id: string; name: string; photoUrl: string | null; catIdNumber: string | null };
}

export interface MyTransfers {
  outgoing: TransferCard[];
  incoming: TransferCard[];
}

export interface OwnershipHistory {
  registeredAt: string;
  items: {
    id: string;
    at: string;
    reason: TransferReason;
    /** First names only — a timeline, never a contact list. */
    from: string | null;
    to: string | null;
  }[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Community
 * ──────────────────────────────────────────────────────────────────────────*/

export interface CommunityCard {
  slug: string;
  name: string;
  photoUrl: string | null;
  gender: string;
  likeCount: number;
  isFeatured: boolean;
  /** Tenure fact — never points or gamification. */
  isFounding: boolean;
  breed: LocalizedName | null;
  city: LocalizedName | null;
  lifeStage: string | null;
}

export interface CommunityListResponse {
  items: CommunityCard[];
  pagination: Pagination;
}

export interface CommunityProfile extends CommunityCard {
  catIdNumber: string | null;
  issuedAt: string | null;
  coverUrl: string | null;
  bio: string | null;
  ownerNickname: string | null;
  gallery: { id: string; url: string }[];
  /** Server-computed age in whole months — never a raw birth date. */
  ageMonths: number | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Notifications
 * ──────────────────────────────────────────────────────────────────────────*/

export interface MemberNotification {
  id: string;
  category: string;
  titleAr: string | null;
  titleEn: string | null;
  bodyAr: string | null;
  bodyEn: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Display helpers — shared so two clients can never label the same state
 * differently (the fixed lexicon, R087).
 * ──────────────────────────────────────────────────────────────────────────*/

export function adoptionStatusLabel(status: AdoptionStatus, isAr: boolean): string {
  switch (status) {
    case "AVAILABLE":
      return isAr ? "يدوّر بيت" : "Looking for a home";
    case "RESERVED":
      return isAr ? "محجوز" : "Reserved";
    case "ADOPTED":
      return isAr ? "لقى بيته" : "Found their home";
    case "WITHDRAWN":
      return isAr ? "مسحوب" : "Withdrawn";
  }
}

export function adoptionRequestLabel(status: AdoptionRequestStatus, isAr: boolean): string {
  switch (status) {
    case "PENDING":
      return isAr ? "بانتظار الرد" : "Waiting for an answer";
    case "ACCEPTED":
      return isAr ? "تمت الموافقة" : "Accepted";
    case "DECLINED":
      return isAr ? "اعتُذر" : "Declined";
    case "WITHDRAWN":
      return isAr ? "مسحوب" : "Withdrawn";
    case "COMPLETED":
      return isAr ? "اكتمل التبني" : "Adoption complete";
  }
}

export function lostFoundStatusLabel(
  kind: LostFoundKind,
  status: LostFoundStatus,
  isAr: boolean
): string {
  if (status === "REUNITED") return isAr ? "رجع لأهله" : "Back home";
  if (status === "CLOSED") return isAr ? "مغلق" : "Closed";
  return kind === "LOST" ? (isAr ? "مفقود" : "Lost") : isAr ? "موجود" : "Found";
}

export function transferStatusLabel(status: TransferStatus, isAr: boolean): string {
  switch (status) {
    case "PENDING":
      return isAr ? "بانتظار القبول" : "Waiting to be accepted";
    case "ACCEPTED":
      return isAr ? "تم النقل" : "Transferred";
    case "DECLINED":
      return isAr ? "اعتُذر عنه" : "Declined";
    case "CANCELLED":
      return isAr ? "مسحوب" : "Withdrawn";
    case "EXPIRED":
      return isAr ? "انتهت صلاحيته" : "Expired";
  }
}

/** "3 years" / "٨ أشهر" — months are what an owner of a kitten actually knows. */
export function formatCatAge(months: number | null | undefined, isAr: boolean): string | null {
  if (months == null || months < 0) return null;
  if (months < 12) {
    return isAr ? `${months} ${months === 1 ? "شهر" : "شهر"}` : `${months} mo`;
  }
  const years = Math.floor(months / 12);
  return isAr ? `${years} ${years <= 10 ? "سنوات" : "سنة"}`.replace("1 سنوات", "سنة") : `${years} yr`;
}

/** A rehoming fee as the owner stated it — free is the honest default. */
export function feeLabel(feeSar: number, isAr: boolean): string {
  if (!feeSar) return isAr ? "بدون مقابل" : "Free to a good home";
  return isAr ? `${feeSar} ر.س` : `SAR ${feeSar}`;
}

/**
 * Whole months between a birth date and now. The API sends `ageMonths` on the
 * shapes that have it; this covers `CatDetail`, which sends a raw birth date
 * to its own owner.
 */
export function ageInMonths(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const months =
    (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  return months < 0 ? null : months;
}
