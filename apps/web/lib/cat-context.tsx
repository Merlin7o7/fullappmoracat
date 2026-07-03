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
import { useAuth } from "@/lib/auth";

export type CatStatus = "ACTIVE" | "ARCHIVED" | "DECEASED";
export type CatMembership = "ACTIVE" | "INACTIVE" | "PENDING";

export interface PortalCat {
  id: string;
  name: string;
  catIdNumber: string | null;
  idIssuedAt: string | null;
  photoUrl: string | null;
  gender: string;
  weightKg: number | null;
  activityLevel: string;
  isIndoor: boolean;
  status: CatStatus;
  membershipStatus: CatMembership;
  isPrimary: boolean;
  archivedAt: string | null;
  deceasedAt: string | null;
  breed: { nameEn: string; nameAr: string } | null;
}

interface CatContextValue {
  cats: PortalCat[]; // full roster (all statuses)
  activeCats: PortalCat[]; // status === ACTIVE, for switching + quick actions
  activeCat: PortalCat | null; // the cat currently in focus
  activeCatId: string | null;
  primaryCat: PortalCat | null;
  isLoading: boolean;
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
  const qc = useQueryClient();
  const [activeCatId, setActiveCatId] = React.useState<string | null>(null);

  const { data: cats = [], isLoading } = useQuery({
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
      await authedFetch(`/cats/${catId}/primary`, { method: "POST", body: "{}" });
      updateUser({ primaryCatId: catId });
      setActiveCat(catId);
      await qc.invalidateQueries({ queryKey: ["cats"] });
      await qc.invalidateQueries({ queryKey: ["overview"] });
    },
    [authedFetch, updateUser, setActiveCat, qc]
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
      setActiveCat,
      setPrimaryCat,
      refresh,
    }),
    [cats, activeCats, activeCat, primaryCat, isLoading, setActiveCat, setPrimaryCat, refresh]
  );

  return <CatContext.Provider value={value}>{children}</CatContext.Provider>;
}
