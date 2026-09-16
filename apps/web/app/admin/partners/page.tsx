"use client";

/**
 * Partners — the clinic pipeline console (MRC-VET-002).
 *
 * The network is invitation-only, so the primary action on this screen is the
 * invitation itself; everything after it (registering, review, setup, live)
 * is one pipeline in one table. Arabic-first and RTL-native (R101); every
 * target is ≥44px (R092).
 */

import * as React from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { ClinicPipeline } from "@/components/admin/partners/clinic-pipeline";
import { InviteClinicDialog } from "@/components/admin/partners/invite-clinic-dialog";

export default function AdminPartnersPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [inviting, setInviting] = React.useState(false);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "الشركاء" : "Partners"}</h1>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "العيادات البيطرية من الدعوة إلى التفعيل — راجع التسجيلات، تحقّق من المستندات، وفعّل الجاهز."
              : "Veterinary clinics from invitation to live — review registrations, check documents, switch on the ready."}
          </p>
        </div>
        <Button onClick={() => setInviting(true)}>
          <UserPlus aria-hidden />
          {isAr ? "دعوة عيادة" : "Invite clinic"}
        </Button>
      </div>

      <ClinicPipeline isAr={isAr} />

      <InviteClinicDialog open={inviting} onClose={() => setInviting(false)} isAr={isAr} />
    </div>
  );
}
