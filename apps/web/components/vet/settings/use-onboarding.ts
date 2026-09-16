"use client";

/**
 * The go-live checklist state (GET /vet/org/onboarding), shared by the Today
 * checklist card and the settings sections that complete its items — one query
 * key, so confirming branches or registering a device ticks the list everywhere
 * without a reload.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVetActor, useVetFetch } from "@/lib/vet-api";
import type { OnboardingState } from "@/lib/vet-registration";

export function onboardingKey(orgId: string | null) {
  return ["vet", "onboarding", orgId] as const;
}

/** Only an APPROVED clinic has a checklist to work through. */
export function useOnboarding() {
  const vetFetch = useVetFetch();
  const { orgId, org } = useVetActor();
  const enabled = !!orgId && org?.org.status === "APPROVED";
  return useQuery({
    queryKey: onboardingKey(orgId),
    queryFn: () => vetFetch<OnboardingState>("/vet/org/onboarding"),
    enabled,
    staleTime: 15_000,
  });
}

/** Write the server's fresh checklist straight into the cache (every action returns it). */
export function useSetOnboarding() {
  const qc = useQueryClient();
  const { orgId } = useVetActor();
  return React.useCallback(
    (state: OnboardingState) => qc.setQueryData(onboardingKey(orgId), state),
    [qc, orgId],
  );
}

/** Mark the checklist stale after something that changes it (device, PIN). */
export function useInvalidateOnboarding() {
  const qc = useQueryClient();
  const { orgId } = useVetActor();
  return React.useCallback(() => qc.invalidateQueries({ queryKey: onboardingKey(orgId) }), [qc, orgId]);
}
