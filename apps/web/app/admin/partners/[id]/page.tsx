"use client";

/**
 * Partner review workspace (MRC-VET-002 §Review).
 *
 * One clinic, one screen, one decision at a time. The header shows only the
 * actions its status allows; banners keep the "why" of the current state on
 * screen; the documents card is where the review actually happens. Everything
 * reads from a single RegistrationState (GET /vet/admin/clinics/:id), and
 * every mutation writes the fresh state straight back.
 *
 * Arabic-first, RTL-native (R101); errors say what happened and what to do
 * next (R084, R112); destructive decisions are confirmed with a reason (R116).
 */

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Button, Card, Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useRegistrationApi, registrationError } from "@/lib/vet-registration";
import { ReviewHeader } from "@/components/admin/partners/review-header";
import { ReviewBanners } from "@/components/admin/partners/review-banners";
import { ClinicIdentityCard, RegistrationInviteCard } from "@/components/admin/partners/clinic-identity-card";
import { ClinicDocumentsCard } from "@/components/admin/partners/clinic-documents-card";
import { ClinicBranchesCard } from "@/components/admin/partners/clinic-branches-card";
import { ClinicTeamCard } from "@/components/admin/partners/clinic-team-card";
import { ClinicAgreementCard, GoLiveChecklistCard } from "@/components/admin/partners/clinic-agreement-card";
import { AccessAuditCard } from "@/components/admin/partners/access-audit-card";
import { clinicDetailKey, useClinicActions } from "@/components/admin/partners/use-clinic-actions";

export default function PartnerReviewPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const api = useRegistrationApi();
  const actions = useClinicActions(id, isAr);

  const { data: state, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: clinicDetailKey(user?.id, id),
    queryFn: () => api.adminDetail(id),
    enabled: !!user?.isStaff && !!id,
    retry: (count, err) => (err as { status?: number })?.status !== 404 && count < 2,
  });

  const backLink = (
    <Link
      href="/admin/partners"
      className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
    >
      {/* Chevron mirrors in RTL so "back" always points backwards (R104). */}
      <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
      {isAr ? "الشركاء" : "Partners"}
    </Link>
  );

  if (isLoading || (!state && !isError)) {
    return (
      <div className="mx-auto max-w-7xl space-y-4" aria-busy="true">
        {backLink}
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !state) {
    const notFound = (error as { status?: number } | null)?.status === 404;
    const f = registrationError(error, isAr);
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        {backLink}
        <Card className="p-10 text-center">
          <p className="font-medium">
            {notFound ? (isAr ? "لم نجد هذه العيادة" : "We couldn't find this clinic") : f.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {notFound
              ? isAr
                ? "ربما سُحبت دعوتها أو أن الرابط غير صحيح. ارجع للقائمة وابحث بالاسم أو البريد."
                : "Its invitation may have been withdrawn, or the link is wrong. Go back to the list and search by name or email."
              : f.message}
          </p>
          {!notFound && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()} loading={isFetching}>
              {!isFetching && <RotateCw aria-hidden />}
              {isAr ? "إعادة المحاولة" : "Try again"}
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const status = state.org.status;
  const showSetup = status === "APPROVED" || status === "LIVE" || status === "SUSPENDED";
  const showAudit = status === "APPROVED" || status === "LIVE" || status === "SUSPENDED";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {backLink}

      <ReviewHeader state={state} actions={actions} isAr={isAr} />

      <ReviewBanners state={state} error={actions.error} onDismissError={actions.clearError} isAr={isAr} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <ClinicDocumentsCard state={state} actions={actions} isAr={isAr} />
          <ClinicBranchesCard state={state} isAr={isAr} />
          <ClinicTeamCard state={state} isAr={isAr} />
        </div>
        <div className="min-w-0 space-y-4">
          {showSetup && <GoLiveChecklistCard state={state} isAr={isAr} />}
          <ClinicIdentityCard state={state} isAr={isAr} />
          <RegistrationInviteCard state={state} isAr={isAr} />
          <ClinicAgreementCard state={state} isAr={isAr} />
        </div>
      </div>

      {showAudit && <AccessAuditCard orgId={state.org.id} isAr={isAr} />}
    </div>
  );
}
