/**
 * The wire for the three surfaces added 2026-09-20 — adoption, lost & found,
 * and Cat ID ownership transfer.
 *
 * ONE FILE, ON PURPOSE. They are three views of a single idea (a cat's life
 * moving between people), they share the same primitives (a city, a cat card,
 * a contact preference), and the vet portal already taught this codebase what
 * happens when a screen's idea of a response drifts from the server's
 * (see lib/vet-wire.ts). Types here mirror the API's read models field for
 * field; nothing casts.
 *
 * PRIVACY NOTE FOR ANYONE EXTENDING THESE TYPES: the API deliberately never
 * sends an owner's email, phone or address on a public read. If you find
 * yourself adding such a field here, the bug is on the server.
 */
import { fetchWithTimeout, httpError } from "./http";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}/api${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw httpError(res.status, await res.json().catch(() => null), `API request to ${path} failed`);
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === false) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
};

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

/** How a listing owner or reporter chose to be reached. */
export type ContactPref = "IN_APP" | "PHONE" | "WHATSAPP" | "EMAIL";

/** Pick a city's label for the current locale, falling back to the other. */
export function cityLabel(city: CityLabel | null, isAr: boolean): string | null {
  if (!city) return null;
  return (isAr ? city.ar : city.en) ?? city.en ?? city.ar;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Adoption
 * ──────────────────────────────────────────────────────────────────────────*/

export type AdoptionStatus = "AVAILABLE" | "RESERVED" | "ADOPTED" | "WITHDRAWN";
export type AdoptionRequestStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "COMPLETED";

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
  breed: { ar: string; en: string } | null;
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
  /** Backed by a real Cat ID — the badge that separates this from a notice board. */
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
    breed: { ar: string; en: string } | null;
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
 * Ownership transfer
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
    breed: { ar: string; en: string } | null;
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
 * The public client (anonymous reads)
 * ──────────────────────────────────────────────────────────────────────────*/

export const catLifeApi = {
  adoptionListings(
    params: {
      cityCode?: string;
      gender?: string;
      stage?: string;
      search?: string;
      freeOnly?: boolean;
      page?: number;
    } = {}
  ) {
    return get<AdoptionListResponse>(`/adoption/listings${qs(params)}`);
  },
  adoptionFacets() {
    return get<AdoptionFacets>("/adoption/facets");
  },
  adoptionListing(id: string) {
    return get<AdoptionListing>(`/adoption/listings/${id}`);
  },
  lostFoundPosts(
    params: {
      kind?: string;
      status?: string;
      cityCode?: string;
      gender?: string;
      search?: string;
      page?: number;
    } = {}
  ) {
    return get<LostFoundListResponse>(`/lost-found/posts${qs(params)}`);
  },
  lostFoundFacets() {
    return get<LostFoundFacets>("/lost-found/facets");
  },
  lostFoundPost(id: string) {
    return get<LostFoundPost>(`/lost-found/posts/${id}`);
  },
  transferPreview(token: string) {
    return get<TransferPreview>(`/transfers/preview?token=${encodeURIComponent(token)}`);
  },
};

/**
 * A deduped visit beacon. Fire-and-forget: a failed count must never surface
 * to the person reading the page.
 */
export function countView(kind: "adoption" | "lost-found", id: string): void {
  const path = kind === "adoption" ? `/adoption/listings/${id}/view` : `/lost-found/posts/${id}/view`;
  try {
    const url = `${BASE}/api${path}`;
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url);
      return;
    }
    void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
  } catch {
    /* counting is never worth an error */
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Display helpers — shared so two screens can never label the same state
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
