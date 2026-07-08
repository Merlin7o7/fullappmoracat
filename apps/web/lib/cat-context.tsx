"use client";

/**
 * The household's cats, and *which one we're acting on right now*.
 *
 * Moracat is built for multi-cat households (core architecture, not an add-on):
 * every cat-aware surface reads the active cat from here rather than assuming a
 * single cat. Switching is instant and remembered; the Primary Cat is the
 * default subject (greeting, featured ID, quick actions).
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import type { CatProfile } from "@/lib/cat-profile";

export type CatStatus = "ACTIVE" | "ARCHIVED" | "DECEASED";
export type CatMembership = "ACTIVE" | "INACTIVE" | "PENDING";

export interface PortalCat {
  id: string;
  name: string;
  catIdNumber: string | null;
  qrToken: string | null;
  idIssuedAt: string | null;
  photoUrl: string | null;
  gender: string;
  birthDate: string | null;
  vaccinationStatus?: string | null;
  weightKg: number | null;
  activityLevel: string;
  isIndoor: boolean;
  status: CatStatus;
  membershipStatus: CatMembership;
  isPrimary: boolean;
  archivedAt: string | null;
  deceasedAt: string | null;
  favoriteFoods?: string[];
  breed: { nameEn: string; nameAr: string } | null;
  /** Character & keepsake layer — drives the personalised card + profile journey. */
  profile?: CatProfile | null;
  coatColor?: string | null;
  isNeutered?: boolean | null;
  microchipNo?: string | null;
}

interface CatContextValue {
  cats: PortalCat[]; // full roster (all statuses)
  activeCats: PortalCat[]; // status === ACTIVE, for switching + quick actions
  activeCat: PortalCat | null; // the cat currently in focus
  activeCatId: string | null;
  primaryCat: PortalCat | null;
  isLoading: boolean;
  /** True when the roster fetch failed — consumers must NOT treat [] as "no cats". */
  isError: boolean;
  /** True while a (re)fetch is in flight — drives retry spinners. */
  isFetching: boolean;
  /** Retry the roster fetch. */
  refetch: () => void;
  /** Instantly switch which cat the portal is acting on. */
  setActiveCat: (catId: string) => void;
  /** Persist a new Primary Cat (server + cached user). */
  setPrimaryCat: (catId: string) => Promise<void>;
  refresh: () => void;
}

const CatContext = React.createContext<CatContextValue | null>(null);

export function useCats() {
  const ctx = React.useContext(CatContext);
  if (!ctx) throw new Error("useCats must be used within CatProvider");
  return ctx;
}

const activeKey = (userId?: string) => `moraqat.activeCat.${userId ?? "anon"}`;

export function CatProvider({ children }: { children: React.ReactNode }) {
  const { user, authedFetch, updateUser } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [activeCatId, setActiveCatId] = React.useState<string | null>(null);

  const { data: cats = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["cats", user?.id],
    queryFn: () => authedFetch<PortalCat[]>("/cats"),
    enabled: !!user,
  });

  const activeCats = React.useMemo(() => cats.filter((c) => c.status === "ACTIVE"), [cats]);
  const primaryCat = React.useMemo(
    () => cats.find((c) => c.isPrimary) ?? activeCats[0] ?? null,
    [cats, activeCats]
  );

  // Resolve the active cat: a remembered choice if still valid, else primary.
  React.useEffect(() => {
    if (!user || cats.length === 0) return;
    const remembered = typeof window !== "undefined" ? localStorage.getItem(activeKey(user.id)) : null;
    const stillValid = remembered && activeCats.some((c) => c.id === remembered);
    const resolved = stillValid ? remembered : primaryCat?.id ?? null;
    setActiveCatId((prev) => (prev && activeCats.some((c) => c.id === prev) ? prev : resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, cats.length, primaryCat?.id]);

  const setActiveCat = React.useCallback(
    (catId: string) => {
      setActiveCatId(catId);
      if (typeof window !== "undefined" && user) localStorage.setItem(activeKey(user.id), catId);
    },
    [user]
  );

  const setPrimaryCat = React.useCallback(
    async (catId: string) => {
      const key = ["cats", user?.id];
      const previous = qc.getQueryData<PortalCat[]>(key);
      const previousPrimaryId = previous?.find((c) => c.isPrimary)?.id ?? null;

      // Optimistic: the star moves instantly so the choice feels immediate.
      if (previous) {
        qc.setQueryData<PortalCat[]>(key, previous.map((c) => ({ ...c, isPrimary: c.id === catId })));
      }
      updateUser({ primaryCatId: catId });
      setActiveCat(catId);

      try {
        await authedFetch(`/cats/${catId}/primary`, { method: "POST", body: "{}" });
        await qc.invalidateQueries({ queryKey: ["cats"] });
        await qc.invalidateQueries({ queryKey: ["overview"] });
      } catch (err) {
        // Roll the optimistic change back and say so plainly — never leave a
        // wrong "primary" showing after a failed write (R112).
        if (previous) qc.setQueryData<PortalCat[]>(key, previous);
        updateUser({ primaryCatId: previousPrimaryId });
        toast({
          title: isAr ? "تعذّر تعيين القط الأساسي" : "Couldn't set the primary cat",
          description: err instanceof Error ? err.message : undefined,
          variant: "error",
        });
        throw err; // callers' success chains must not run on failure
      }
    },
    [authedFetch, updateUser, setActiveCat, qc, user?.id, toast, isAr]
  );

  const refresh = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["cats"] });
  }, [qc]);

  const activeCat = React.useMemo(
    () => activeCats.find((c) => c.id === activeCatId) ?? primaryCat,
    [activeCats, activeCatId, primaryCat]
  );

  const value = React.useMemo<CatContextValue>(
    () => ({
      cats,
      activeCats,
      activeCat,
      activeCatId: activeCat?.id ?? null,
      primaryCat,
      isLoading,
      isError,
      isFetching,
      refetch,
      setActiveCat,
      setPrimaryCat,
      refresh,
    }),
    [cats, activeCats, activeCat, primaryCat, isLoading, isError, isFetching, refetch, setActiveCat, setPrimaryCat, refresh]
  );

  return <CatContext.Provider value={value}>{children}</CatContext.Provider>;
}
