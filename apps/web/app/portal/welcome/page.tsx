"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { localizeName } from "@/lib/translit";
import { LaunchInfo } from "@/components/welcome/launch-info";

/**
 * Right after sign-up (the Cat ID ceremony hands off here): what Moracat is,
 * what's free today, the monthly membership — starting price, what each plan
 * includes, the term discounts — and the launch gate: memberships open once
 * the register reaches 1,000 cats. Then on to designing the card.
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
    queryFn: () => authedFetch<{ id: string; name: string }>(`/cats/${catId}`),
    enabled: !!user && !!catId,
  });
  return <LaunchInfo catId={catId} catName={cat ? localizeName(cat.name, isAr ? "ar" : "en") : null} isAr={isAr} />;
}
