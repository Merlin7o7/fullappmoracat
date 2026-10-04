"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { localizeName } from "@/lib/translit";
import { LaunchInfo } from "@/components/welcome/launch-info";
import { NoPhotoNudge } from "@/components/signup/no-photo-nudge";

/**
 * Right after sign-up (the Cat ID ceremony hands off here): the honest
 * "what's next" — what the cat now has, the one next step (design the card),
 * and that care plans open later. See components/welcome/launch-info.tsx.
 */
export default function WelcomePage() {
  return (
    <React.Suspense fallback={<div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <WelcomeInner />
    </React.Suspense>
  );
}

function WelcomeInner() {
  const params = useSearchParams();
  const catId = params.get("cat");
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { data: cat } = useQuery({
    queryKey: ["welcome-cat", catId],
    queryFn: () => authedFetch<{ id: string; name: string; gender?: string | null }>(`/cats/${catId}`),
    enabled: !!user && !!catId,
  });
  return (
    <>
      {/* A faceless cat isn't shown in the community — say so after the reveal, with the fix right there. */}
      <NoPhotoNudge catId={catId} isAr={isAr} />
      <LaunchInfo catId={catId} catName={cat ? localizeName(cat.name, isAr ? "ar" : "en") : null} catGender={cat?.gender ?? null} isAr={isAr} />
    </>
  );
}
