/** Thin typed client for the Moraqat API. */
import { fetchWithTimeout, httpError } from "./http";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export interface ProductListItem {
  id: string;
  slug: string;
  sku: string;
  type: string;
  nameEn: string;
  nameAr: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  brand: { slug: string; nameEn: string; nameAr: string } | null;
  image: string | null;
}

export interface ProductsResponse {
  items: ProductListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}/api${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw httpError(res.status, await res.json().catch(() => null), `API request to ${path} failed`);
  return res.json() as Promise<T>;
}

export interface BlogListItem {
  slug: string;
  titleEn: string;
  titleAr: string;
  excerptEn: string | null;
  excerptAr: string | null;
  coverUrl: string | null;
  authorName: string | null;
  publishedAt: string | null;
  category: { slug: string; nameEn: string; nameAr: string } | null;
}

export interface BlogPost extends BlogListItem {
  bodyEn: string | null;
  bodyAr: string | null;
}

export interface Faq {
  id: string;
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
  category: string | null;
}

export interface Testimonial {
  id: string;
  authorName: string;
  role: string | null;
  quoteEn: string;
  quoteAr: string;
  rating: number;
}

export interface LocalizedName {
  nameEn: string;
  nameAr: string;
}

export interface CommunityCard {
  slug: string;
  name: string;
  photoUrl: string | null;
  gender: string;
  likeCount: number;
  isFeatured: boolean;
  /** Tenure fact — shared before the founding cutoff (never points/gamification). */
  isFounding: boolean;
  breed: LocalizedName | null;
  city: LocalizedName | null;
  lifeStage: string | null;
}

export interface CommunityListResponse {
  items: CommunityCard[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
}

export interface CommunityProfile extends CommunityCard {
  catIdNumber: string | null;
  issuedAt: string | null;
  coverUrl: string | null;
  bio: string | null;
  ownerNickname: string | null;
  gallery: { id: string; url: string }[];
  /** Server-computed age in whole months when the owner shows age — never a raw birth date. */
  ageMonths: number | null;
}

export interface CommunityFacets {
  breeds: (LocalizedName & { id: string })[];
  cities: (LocalizedName & { id: string })[];
  /** How many cats are genuinely featured — 0 hides the Featured door. */
  featuredCount: number;
}

/** Response shape of POST/DELETE /community/cats/:slug/like (via authedFetch). */
export interface LikeToggleResponse {
  liked: boolean;
  likeCount: number;
}

export const api = {
  community(
    params: { breedId?: string; cityId?: string; gender?: string; stage?: string; sort?: string; search?: string; page?: number } = {}
  ) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, String(v));
    const qs = q.toString();
    return get<CommunityListResponse>(`/community/cats${qs ? `?${qs}` : ""}`);
  },
  communityCat(slug: string) {
    return get<CommunityProfile>(`/community/cats/${slug}`);
  },
  communityFacets() {
    return get<CommunityFacets>("/community/facets");
  },
  products(params: { type?: string; brand?: string; search?: string; sort?: string; page?: number } = {}) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, String(v));
    const qs = q.toString();
    return get<ProductsResponse>(`/products${qs ? `?${qs}` : ""}`);
  },
  blog(page = 1) {
    return get<{ items: BlogListItem[]; pagination: { total: number; totalPages: number } }>(`/content/blog?page=${page}`);
  },
  blogPost(slug: string) {
    return get<BlogPost>(`/content/blog/${slug}`);
  },
  faqs() {
    return get<Faq[]>("/content/faqs");
  },
  testimonials() {
    return get<Testimonial[]>("/content/testimonials");
  },
};

export const PRODUCT_TYPES = [
  { key: "", en: "All", ar: "الكل" },
  { key: "DRY_FOOD", en: "Dry food", ar: "طعام جاف" },
  { key: "WET_FOOD", en: "Wet food", ar: "طعام رطب" },
  { key: "LITTER", en: "Litter", ar: "رمل" },
  { key: "TREATS", en: "Treats", ar: "مكافآت" },
  { key: "TOY", en: "Toys", ar: "ألعاب" },
  { key: "SUPPLEMENT", en: "Supplements", ar: "مكملات" },
  { key: "HEALTHCARE", en: "Health", ar: "العناية" },
] as const;
