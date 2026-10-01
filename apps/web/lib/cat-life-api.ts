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
 * The wire types now live in @moraqat/core (`member-contract.ts`).
 *
 * They moved there when the iOS app became a second reader of these same
 * endpoints: two hand-maintained copies of `AdoptionListing` drift, and the
 * drift shows up as a blank screen rather than a failed build — exactly the
 * failure `vet-contract.ts` was created to end. They are re-exported here so
 * every existing `from "@/lib/cat-life-api"` import keeps working unchanged.
 * ──────────────────────────────────────────────────────────────────────────*/
export type {
  CityLabel,
  Pagination,
  ContactPref,
  AdoptionStatus,
  AdoptionRequestStatus,
  AdoptionCatCard,
  AdoptionCard,
  AdoptionListing,
  AdoptionListResponse,
  AdoptionFacets,
  MyAdoption,
  AdoptionEnquiry,
  LostFoundKind,
  LostFoundStatus,
  LostFoundCard,
  LostFoundPost,
  LostFoundListResponse,
  LostFoundFacets,
  LostFoundMessage,
  TransferStatus,
  TransferReason,
  TransferPreview,
  TransferCard,
  MyTransfers,
  OwnershipHistory,
} from "@moraqat/core";
export { cityLabel } from "@moraqat/core";

import type {
  AdoptionListResponse,
  AdoptionFacets,
  AdoptionListing,
  LostFoundListResponse,
  LostFoundFacets,
  LostFoundPost,
  TransferPreview,
} from "@moraqat/core";

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
 * Display helpers — now in @moraqat/core so the web and the iOS app cannot
 * label the same state differently (the fixed lexicon, R087). Re-exported so
 * existing imports are untouched.
 * ──────────────────────────────────────────────────────────────────────────*/
export {
  adoptionStatusLabel,
  adoptionRequestLabel,
  lostFoundStatusLabel,
  transferStatusLabel,
  formatCatAge,
  feeLabel,
} from "@moraqat/core";
