"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

/**
 * Share attribution (MRC-UX-AUDIT-2026-10-04 Problem 9 / Opportunity 4).
 *
 * Every link a member shares — the story, the card, a poster, a moment —
 * lands a stranger on /i/{slug}: «هذي هوية لولو». That page names the cat
 * that brought the visitor (only while the cat is public — the server
 * decides, never the link) and carries `ref` + `src` into /register, where
 * the existing ?ref= capture attributes the signup to the member and the
 * first-touch cookie records the channel.
 *
 */
export { SITE_URL, shareLandingUrl, registerHref, type ShareSrc } from "./share-url";
import { shareLandingUrl, type ShareSrc } from "./share-url";

/** The member's own referral code (lazily minted by the API on first read). */
export function useReferralCode(): string | null {
  const { authedFetch, user } = useAuth();
  const q = useQuery({
    // Same key as ReferralCard, so one fetch serves both.
    queryKey: ["referral", user?.id],
    queryFn: () => authedFetch<{ code: string; invited: number; link: string }>("/account/referral"),
    enabled: !!user,
    staleTime: 10 * 60_000,
  });
  return q.data?.code ?? null;
}

/** Hook form: the attributed landing URL for one cat and one channel. */
export function useShareLink(slug: string | null | undefined, src: ShareSrc): string {
  const code = useReferralCode();
  return shareLandingUrl({ slug, code, src });
}
