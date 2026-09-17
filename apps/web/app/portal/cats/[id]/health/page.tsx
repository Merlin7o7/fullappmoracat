"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { QueryError } from "@/components/query-error";
import { CatHealthRecord, type HealthRecord } from "@/components/cat-health-record";
import { HealthProfileForm } from "@/components/health-profile-form";
import { EmergencyContactForm } from "@/components/emergency-contact-form";
import { CatHealthPanel } from "@/components/cat-health-panel";
import { CertificateCard } from "@/components/certificate-card";
import { useCats } from "@/lib/cat-context";

/**
 * The living record (MRC-PROD-001 T3) — the visible half of the moat. What
 * the clinic wrote, what the owner keeps, and the safety facts any treating
 * clinic can read. Order: is my cat protected? → what happened → what I
 * maintain → what I can add myself.
 */
export default function CatHealthPage() {
  const { id } = useParams<{ id: string }>();
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { cats } = useCats();
  const cat = cats.find((c) => c.id === id);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["cat-health", id],
    queryFn: () => authedFetch<HealthRecord>(`/cats/${id}/health`),
    enabled: !!user && !!id,
  });

  if (isError) return <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />;
  if (isLoading || !data) return <div className="space-y-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="space-y-6">
      <CatHealthRecord record={data} isAr={isAr} />
      {cat && <CertificateCard catId={id} catName={cat.name} hasCatId={!!cat.catIdNumber} isAr={isAr} />}
      <HealthProfileForm record={data} isAr={isAr} />
      <EmergencyContactForm record={data} isAr={isAr} />
      <section className="space-y-2">
        <h2 className="font-display text-lg font-semibold">{isAr ? "أضف بنفسك" : "Add it yourself"}</h2>
        <p className="text-xs text-muted-foreground">
          {isAr ? "تطعيم من دفتر ورقي، زيارة قديمة، أو صورة مستند — يُحفظ هنا ويُعلَّم أنه مُدخل يدوياً." : "A dose from a paper book, an old visit or a document photo — kept here and marked as self-reported."}
        </p>
        <CatHealthPanel catId={id} isAr={isAr} />
      </section>
    </div>
  );
}
