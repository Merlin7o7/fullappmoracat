"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { QueryError } from "@/components/query-error";
import { CatHealthRecord, type HealthRecord } from "@/components/cat-health-record";
import { HealthProfileForm } from "@/components/health-profile-form";
import { EmergencyContactForm } from "@/components/emergency-contact-form";
import { CatHealthPanel } from "@/components/cat-health-panel";
import { CertificateCard } from "@/components/certificate-card";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { CatCare } from "@/components/cat-profile/cat-care";
import { VetShare } from "@/components/cat-profile/vet-share";
import { AddCareTask } from "@/components/care/add-care-task";
import { WeightLog } from "@/components/care/weight-log";

/**
 * The living record (MRC-PROD-001 T3) — the visible half of the moat. What
 * the clinic wrote, what the owner keeps, and the safety facts any treating
 * clinic can read. Order: what needs doing (care) → is my cat protected?
 * → what happened → weight → sending it to a vet → what I maintain → what I
 * can add myself. Care and weight live here, not on the profile overview —
 * each tab owns its content (audit 2026-10-04, «Cat profile»).
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

  const name = cat ? localizeName(cat.name, isAr ? "ar" : "en") : "";

  return (
    <div className="space-y-8">
      {/* Care renders on its own query, so it never waits on the record. */}
      <section id="care" aria-labelledby="care-title" className="scroll-mt-20 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 id="care-title" className="font-display text-2xl">{isAr ? "الرعاية" : "Care"}</h2>
          <AddCareTask catId={id} isAr={isAr} invalidate={[["cat-care", id], ["care-agenda"]]} />
        </div>
        <CatCare catId={id} isAr={isAr} name={name} />
      </section>

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : isLoading || !data ? (
        <div className="space-y-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-40 w-full" /></div>
      ) : (
        <HealthBody id={id} record={data} isAr={isAr} catName={cat?.name ?? ""} name={name} hasCatId={!!cat?.catIdNumber} />
      )}
    </div>
  );
}

function HealthBody({
  id, record: data, isAr, catName, name, hasCatId,
}: {
  id: string;
  record: HealthRecord;
  isAr: boolean;
  catName: string;
  name: string;
  hasCatId: boolean;
}) {
  return (
    <div className="space-y-8">
      <CatHealthRecord record={data} isAr={isAr} />

      <section id="weight" aria-labelledby="weight-title" className="scroll-mt-20 space-y-3">
        <h2 id="weight-title" className="font-display text-2xl">{isAr ? "الوزن" : "Weight"}</h2>
        <Card className="p-5">
          <WeightLog catId={id} isAr={isAr} />
        </Card>
      </section>

      <VetShare catId={id} catName={name} isAr={isAr} />
      <CertificateCard catId={id} catName={catName} hasCatId={hasCatId} isAr={isAr} />
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
