"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button, Card } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { CatCommunityPanel } from "@/components/cat-community-panel";
import { LostModeCard } from "@/components/lost-mode-card";
import { AccessLedger } from "@/app/portal/health-access/access-ledger";

/**
 * Per-cat privacy (MRC-PROD-001 T3): what the public sees, which clinics may
 * open the record, and who has. The clinic-permission flow itself lives on
 * /portal/health-access (it spans the household); this page links there for
 * this cat rather than duplicating the grant dialog.
 */
export default function CatPrivacyPage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { cats } = useCats();
  const cat = cats.find((c) => c.id === id);
  if (!cat) return null;

  return (
    <div className="space-y-6">
      {cat.status === "ACTIVE" && (
        <LostModeCard catId={cat.id} catName={cat.name} qrToken={cat.qrToken} lostModeAt={cat.lostModeAt} isAr={isAr} />
      )}
      {cat.status === "ACTIVE" && (
        <CatCommunityPanel catId={cat.id} catName={cat.name} photoUrl={cat.photoUrl} isAr={isAr} />
      )}

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-5" /></span>
          <div>
            <h2 className="font-display text-lg font-semibold">{isAr ? "من يفتح السجل الطبي" : "Who can open the medical record"}</h2>
            <p className="text-sm text-muted-foreground">
              {isAr
                ? `أنت من يقرّر أي عيادة تفتح ملف ${cat.name}، وإلى أي مدى. التنبيهات الطبية (الحساسيات، الأدوية) تبقى ظاهرة لأي عيادة معالجة — لأن حساسية مخفية قد تقتل.`
                : `You decide which clinic can open ${cat.name}'s file, and how far. Safety alerts (allergies, medication) stay visible to any treating clinic — a hidden allergy can kill.`}
            </p>
          </div>
        </div>
        <Link href="/portal/health-access">
          <Button variant="outline" size="sm">{isAr ? "إدارة الأذونات" : "Manage permissions"} <ArrowRight className="size-4 rtl:rotate-180" /></Button>
        </Link>
      </Card>

      <AccessLedger catId={cat.id} catName={cat.name} isAr={isAr} />
    </div>
  );
}
