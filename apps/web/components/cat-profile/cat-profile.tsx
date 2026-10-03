"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Camera, Pencil, Share2, Syringe, Stethoscope, Cake, Sparkles, Siren, FileText, Palette,
} from "lucide-react";
import {
  Button, Card, EmptyState, IdBand, Ledger, LedgerRow, Seal, Skeleton, StatusTag, cn, type StatusTone,
} from "@moraqat/ui";
import { ageInMonths, formatAge, formatDate, formatRelative, formatWeight, qrValueFor, saudiCityLabel } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import type { PortalCat } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { resolvePersonalization } from "@/lib/cat-profile";
import type { HealthRecord } from "@/components/cat-health-record";
import { Illo3D } from "@/components/illo-3d";
import { QueryError } from "@/components/query-error";
import { CatIdShare } from "@/components/cat-id-share";
import { CertificateCard } from "@/components/certificate-card";
import { CatSectionTabs } from "./section-tabs";
import { CareList, type CareTaskView } from "@/components/care/care-list";
import { AddCareTask } from "@/components/care/add-care-task";
import { WeightLog } from "@/components/care/weight-log";
import { VetShare } from "./vet-share";
import { CompleteFile } from "./complete-file";
import { MomentShare } from "@/components/moments/moment-share";

/**
 * The cat's profile — the flagship of the product (UX reassessment §3).
 *
 * Reads like a passport, a health record and a life story, in that order:
 *   1. who this cat is            (hero + the ID band)
 *   2. is everything all right?   (the status ledger — answered in one glance)
 *   3. what needs doing           (care)
 *   4. how they're doing          (weight)
 *   5. their life so far          (timeline)
 *   6. if something goes wrong    (safety: lost mode, emergency, allergies)
 *   7. the ID as a possession     (share, export, Wallet, certificate)
 *
 * The cat is the hero (P09): the photo leads, the name is the largest type on
 * the screen, and the person only appears where the cat needs them.
 */
export function CatProfile({ cat, isAr }: { cat: PortalCat; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const loc = isAr ? "ar" : "en";
  const name = localizeName(cat.name, loc);
  const health = useQuery({
    queryKey: ["cat-health", cat.id],
    queryFn: () => authedFetch<HealthRecord>(`/cats/${cat.id}/health`),
    enabled: !!user,
  });

  const months = ageInMonths(cat.birthDate);
  const facts = [
    cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : null,
    formatAge(months, loc),
    cat.gender === "MALE" ? (isAr ? "ذكر" : "Male") : cat.gender === "FEMALE" ? (isAr ? "أنثى" : "Female") : null,
    cat.cityCode ? saudiCityLabel(cat.cityCode, loc) : null,
  ].filter(Boolean) as string[];

  const lost = !!cat.lostModeAt;
  const inactive = cat.status !== "ACTIVE";

  return (
    <div className="space-y-8">
      {/* ── 1 · Who this cat is ───────────────────────────────────────────── */}
      <section aria-labelledby="cat-name" className="space-y-5">
        <Link href="/portal" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {isAr ? "قططي" : "My cats"}
        </Link>

        {lost && (
          <div className="space-y-2">
          <Link
            href={`/portal/cats/${cat.id}/privacy`}
            className="flex items-center gap-3 rounded-2xl bg-destructive px-4 py-3 text-destructive-foreground"
          >
            <Siren className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{isAr ? `${name} مُبلّغ عنه مفقوداً` : `${name} is marked lost`}</span>
              <span className="block text-sm opacity-90">
                {isAr ? "كل من يمسح رمزه يرى طلب المساعدة. افتح للتحديث أو الإيقاف." : "Anyone who scans the tag sees your call for help. Open to update or end it."}
              </span>
            </span>
          </Link>
          {/* The poster for the neighbourhood's WhatsApp groups — the growth
              loop and the rescue in one (UX reassessment §25.1). */}
          <MomentShare
            kind="lost"
            isAr={isAr}
            catName={name}
            photoUrl={cat.photoUrl}
            catIdNumber={cat.catIdNumber}
            lines={[
              ...(cat.district ? [cat.district] : []),
              isAr ? `مفقود منذ ${formatDate(cat.lostModeAt!, "ar", "medium")}` : `Missing since ${formatDate(cat.lostModeAt!, "en", "medium")}`,
            ]}
            qrUrl={cat.qrToken ? qrValueFor(process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co", cat.qrToken) : null}
            shareText={isAr ? `${name} مفقود — لو شفته امسح الرمز في الصورة 🙏` : `${name} is missing — if you see them, scan the code in the image 🙏`}
            label={isAr ? "شارك ملصق البحث" : "Share the missing poster"}
            variant="destructive"
            size="md"
            className="w-full sm:w-auto"
          />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-end">
          <div
            className={cn(
              "relative aspect-square overflow-hidden rounded-2xl bg-[hsl(var(--cream))]",
              cat.status === "DECEASED" && "grayscale-[35%]"
            )}
          >
            {cat.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cat.photoUrl} alt={isAr ? `صورة ${name}` : `Photo of ${name}`} className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center">
                <Illo3D name="cat" className="size-48 sm:size-56" px={224} />
                <Link
                  href={`/portal/cats/${cat.id}/edit#photos`}
                  className="absolute bottom-3 start-3 inline-flex h-11 items-center gap-2 rounded-md bg-card/95 px-4 text-sm font-medium shadow-e1 hover:bg-card"
                >
                  <Camera className="size-4" aria-hidden /> {isAr ? `أضف صورة ${name}` : `Add ${name}'s photo`}
                </Link>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {cat.status === "DECEASED" && <StatusTag tone="neutral">{isAr ? "في الذاكرة" : "In memoriam"}</StatusTag>}
              {cat.status === "ARCHIVED" && <StatusTag tone="neutral">{isAr ? "مؤرشف" : "Archived"}</StatusTag>}
              {cat.isPrimary && !inactive && <StatusTag tone="brand">{isAr ? "القط الأساسي" : "Primary cat"}</StatusTag>}
            </div>
            <h1 id="cat-name" className="font-display text-5xl leading-tight text-foreground sm:text-6xl">
              {name}
            </h1>
            {facts.length > 0 && <p className="text-base text-muted-foreground">{facts.join(" · ")}</p>}

            <div className="overflow-hidden rounded-md">
              <IdBand
                kind={isAr ? "هوية مرقط" : "Moracat ID"}
                serial={cat.catIdNumber ?? undefined}
                seal={<Seal label={isAr ? "صادرة من مرقط" : "Issued by Moracat"} />}
              />
            </div>
            {cat.idIssuedAt && (
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? `في سجل مرقط منذ ${formatDate(cat.idIssuedAt, "ar", "monthYear")} · الرقم التسلسلي ${cat.catNumber}`
                  : `In the Moracat register since ${formatDate(cat.idIssuedAt, "en", "monthYear")} · serial ${cat.catNumber}`}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {cat.catIdNumber && (
                <Link
                  href={`/portal/cats/new?cat=${cat.id}&step=design`}
                  className="btn-shine inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Palette className="size-4" aria-hidden /> {isAr ? `صمّم بطاقة ${name}` : `Design ${name}'s card`}
                </Link>
              )}
              <Button variant="contextual" onClick={() => document.getElementById("share")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <Share2 className="size-4" aria-hidden /> {isAr ? "الهوية والمشاركة" : "ID & sharing"}
              </Button>
              <Link
                href={`/portal/cats/${cat.id}/edit`}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-card px-5 text-sm font-medium hover:bg-muted"
              >
                <Pencil className="size-4" aria-hidden /> {isAr ? "تعديل الملف" : "Edit profile"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {cat.catIdNumber && !resolvePersonalization(cat.profile?.personalization).isCustomised && (
        <DesignNudge catId={cat.id} name={name} isAr={isAr} />
      )}

      <CatSectionTabs catId={cat.id} isAr={isAr} />

      {health.isError ? (
        <QueryError isAr={isAr} onRetry={() => health.refetch()} retrying={health.isFetching} />
      ) : health.isLoading || !health.data ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <ProfileBody cat={cat} record={health.data} isAr={isAr} name={name} />
      )}

      {/* ── 7 · The ID as a possession ─────────────────────────────────────── */}
      {cat.catIdNumber && (
        <section id="share" aria-labelledby="share-title" className="scroll-mt-20 space-y-4">
          <SectionTitle id="share-title" title={isAr ? "الهوية والمشاركة" : "The ID & sharing"} />
          <VetShare catId={cat.id} catName={name} isAr={isAr} />
          <Card className="p-5 sm:p-6">
            <CatIdShare cat={cat} isAr={isAr} />
          </Card>
          <CertificateCard catId={cat.id} catName={cat.name} hasCatId={!!cat.catIdNumber} isAr={isAr} />
        </section>
      )}
    </div>
  );
}

function SectionTitle({ id, title, action }: { id: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 id={id} className="font-display text-2xl text-foreground">
        {title}
      </h2>
      {action}
    </div>
  );
}

const STANDING: Record<HealthRecord["vaccination"]["standing"], { tone: StatusTone; ar: string; en: string }> = {
  UP_TO_DATE: { tone: "positive", ar: "محدّثة", en: "Up to date" },
  DUE_SOON: { tone: "attention", ar: "موعد قريب", en: "Due soon" },
  OVERDUE: { tone: "critical", ar: "متأخرة", en: "Overdue" },
  UNKNOWN: { tone: "neutral", ar: "غير مسجّلة", en: "Not recorded" },
};

function ProfileBody({ cat, record, isAr, name }: { cat: PortalCat; record: HealthRecord; isAr: boolean; name: string }) {
  const loc = isAr ? "ar" : "en";
  const standing = STANDING[record.vaccination.standing];

  // The next open care item, from the engine (same query the care section uses).
  const { authedFetch, user } = useAuth();
  const careQ = useQuery({
    queryKey: ["cat-care", cat.id],
    queryFn: () => authedFetch<{ protocolApproved: boolean; tasks: CareTaskView[] }>(`/cats/${cat.id}/care`),
    enabled: !!user,
  });
  const nextCare = careQ.data?.tasks.find((t) => t.state !== "done" && t.state !== "skipped");

  const weights = record.weights.length
    ? record.weights.map((w) => ({ weightKg: w.weightKg, measuredAt: w.measuredAt, source: w.source }))
    : cat.weightKg
      ? [{ weightKg: cat.weightKg, measuredAt: cat.idIssuedAt ?? new Date().toISOString(), source: "owner" }]
      : [];
  const sortedW = [...weights].sort((a, b) => +new Date(a.measuredAt) - +new Date(b.measuredAt));
  const latestW = sortedW[sortedW.length - 1];
  const prevW = sortedW[sortedW.length - 2];
  const delta = latestW && prevW ? Math.round((latestW.weightKg - prevW.weightKg) * 10) / 10 : null;

  const timeline = buildTimeline(cat, record, isAr).slice(0, 6);

  return (
    <div className="space-y-8">
      {/* ── 2 · Is everything all right? ──────────────────────────────────── */}
      <section aria-labelledby="status-title" className="space-y-3">
        <SectionTitle id="status-title" title={isAr ? `${name} الآن` : `${name} right now`} />
        <Card className="px-5 py-1">
          <Ledger>
            <LedgerRow
              label={isAr ? "التطعيمات" : "Vaccinations"}
              value={<StatusTag tone={standing.tone}>{isAr ? standing.ar : standing.en}</StatusTag>}
              hint={
                record.vaccination.nextDueAt
                  ? isAr
                    ? `الجرعة القادمة ${formatDate(record.vaccination.nextDueAt, "ar", "medium")}`
                    : `Next dose ${formatDate(record.vaccination.nextDueAt, "en", "medium")}`
                  : undefined
              }
            />
            <LedgerRow
              label={isAr ? "الرعاية القادمة" : "Next care"}
              value={nextCare ? (isAr ? nextCare.title.ar : nextCare.title.en) : isAr ? "لا شيء مستحق" : "Nothing due"}
              hint={
                nextCare
                  ? nextCare.state === "overdue"
                    ? isAr ? `متأخر — كان موعده ${formatRelative(nextCare.dueAt, loc)}` : `Overdue — it was due ${formatRelative(nextCare.dueAt, loc)}`
                    : formatRelative(nextCare.dueAt, loc)
                  : undefined
              }
            />
            <LedgerRow
              label={isAr ? "الوزن" : "Weight"}
              value={latestW ? formatWeight(latestW.weightKg, loc) : isAr ? "لم يُسجّل" : "Not recorded"}
              hint={
                delta != null && delta !== 0
                  ? isAr
                    ? `${delta > 0 ? "+" : "−"}${formatWeight(Math.abs(delta), "ar")} منذ القياس السابق`
                    : `${delta > 0 ? "+" : "−"}${formatWeight(Math.abs(delta), "en")} since the last weigh-in`
                  : undefined
              }
            />
            <LedgerRow
              label={isAr ? "الشريحة الإلكترونية" : "Microchip"}
              value={record.cat.microchipNo ? (isAr ? "مسجّلة" : "On file") : isAr ? "غير مسجّلة" : "Not on file"}
            />
            <LedgerRow
              label={isAr ? "عيادته" : "Home clinic"}
              value={record.cat.homeBranch ? (isAr ? record.cat.homeBranch.clinic.ar : record.cat.homeBranch.clinic.en) : isAr ? "لم تُحدد" : "Not set"}
            />
          </Ledger>
        </Card>
      </section>

      <CompleteFile cat={cat} record={record} isAr={isAr} />

      {/* ── 3 · What needs doing ──────────────────────────────────────────── */}
      <section aria-labelledby="care-title" className="space-y-3">
        <SectionTitle id="care-title" title={isAr ? "الرعاية" : "Care"} action={<AddCareTask catId={cat.id} isAr={isAr} invalidate={[["cat-care", cat.id], ["care-agenda"]]} />} />
        <CatCare catId={cat.id} isAr={isAr} name={name} />
      </section>

      {/* ── 4 · How they're doing ─────────────────────────────────────────── */}
      <section id="weight" aria-labelledby="weight-title" className="scroll-mt-20 space-y-3">
        <SectionTitle id="weight-title" title={isAr ? "الوزن" : "Weight"} />
        <Card className="p-5">
          <WeightLog catId={cat.id} isAr={isAr} />
        </Card>
      </section>

      {/* ── 5 · Their life so far ─────────────────────────────────────────── */}
      <section aria-labelledby="life-title" className="space-y-3">
        <SectionTitle
          id="life-title"
          title={isAr ? `حياة ${name}` : `${name}'s life`}
          action={
            <Link href={`/portal/cats/${cat.id}/timeline`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
              {isAr ? "الألبوم كاملاً" : "The full album"}
            </Link>
          }
        />
        <Card className="p-5">
          <ol className="relative space-y-5 border-s border-border ps-6">
            {timeline.map((e) => (
              <li key={e.key} className="relative">
                <span
                  aria-hidden
                  className="absolute -start-[1.95rem] top-0.5 grid size-6 place-items-center rounded-full border border-border bg-card text-muted-foreground"
                >
                  <e.icon className="size-3.5" />
                </span>
                <p className="font-medium">{e.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(e.at, loc, "medium")}
                  {e.sub ? ` · ${e.sub}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {/* ── 6 · If something goes wrong ───────────────────────────────────── */}
      <section aria-labelledby="safety-title" className="space-y-3">
        <SectionTitle
          id="safety-title"
          title={isAr ? "الأمان" : "Safety"}
          action={
            <Link href={`/portal/cats/${cat.id}/privacy`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
              {isAr ? "الأمان والخصوصية" : "Safety & privacy"}
            </Link>
          }
        />
        <Card className="px-5 py-1">
          <Ledger>
            <LedgerRow
              label={isAr ? "وضع الفقدان" : "Lost mode"}
              value={
                cat.lostModeAt ? (
                  <StatusTag tone="critical">{isAr ? "مفعّل" : "On"}</StatusTag>
                ) : (
                  <Link href={`/portal/cats/${cat.id}/privacy`} className="font-medium text-destructive hover:underline">
                    {isAr ? `بلّغ أن ${name} مفقود` : `Report ${name} lost`}
                  </Link>
                )
              }
            />
            <LedgerRow
              label={isAr ? "جهة اتصال للطوارئ" : "Emergency contact"}
              value={record.cat.emergencyContact ? record.cat.emergencyContact.name : isAr ? "لم تُضف" : "Not added"}
            />
            <LedgerRow
              label={isAr ? "الحساسية" : "Allergies"}
              value={record.cat.allergies.length ? record.cat.allergies.join("، ") : isAr ? "لا شيء مسجّل" : "None recorded"}
            />
            <LedgerRow
              label={isAr ? "حالات مزمنة" : "Conditions"}
              value={record.cat.healthConditions.length ? record.cat.healthConditions.join("، ") : isAr ? "لا شيء مسجّل" : "None recorded"}
            />
          </Ledger>
        </Card>
      </section>
    </div>
  );
}

type TimelineEvent = { key: string; at: string; title: string; sub?: string; icon: React.ElementType };

function buildTimeline(cat: PortalCat, record: HealthRecord, isAr: boolean): TimelineEvent[] {
  const name = localizeName(cat.name, isAr ? "ar" : "en");
  const ev: TimelineEvent[] = [];
  if (cat.birthDate) ev.push({ key: "born", at: cat.birthDate, title: isAr ? `وُلد ${name}` : `${name} was born`, icon: Cake });
  if (cat.idIssuedAt) {
    ev.push({ key: "joined", at: cat.idIssuedAt, title: isAr ? "انضم إلى سجل مرقط" : "Joined the Moracat register", sub: cat.catIdNumber ?? undefined, icon: Sparkles });
  }
  for (const v of record.vaccination.records) {
    ev.push({
      key: `vax-${v.id}`,
      at: v.administeredAt,
      title: isAr ? `تطعيم: ${v.name}` : `Vaccine: ${v.name}`,
      sub: v.clinic ? (isAr ? v.clinic.ar : v.clinic.en) : undefined,
      icon: Syringe,
    });
  }
  for (const v of record.visits) {
    ev.push({
      key: `visit-${v.id}`,
      at: v.checkedInAt,
      title: isAr ? "زيارة عيادة" : "Clinic visit",
      sub: isAr ? v.clinic.ar : v.clinic.en,
      icon: Stethoscope,
    });
  }
  for (const d of record.prescriptions.slice(0, 3)) {
    ev.push({ key: `rx-${d.id}`, at: d.issuedAt, title: isAr ? `وصفة: ${d.medication}` : `Prescription: ${d.medication}`, icon: FileText });
  }
  return ev.sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

/** The cat's care, from the engine: open items first, recently done below. */
function CatCare({ catId, isAr, name }: { catId: string; isAr: boolean; name: string }) {
  const { authedFetch, user } = useAuth();
  const q = useQuery({
    queryKey: ["cat-care", catId],
    queryFn: () => authedFetch<{ protocolApproved: boolean; tasks: CareTaskView[] }>(`/cats/${catId}/care`),
    enabled: !!user,
  });
  if (q.isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;
  if (q.isError) return <QueryError isAr={isAr} onRetry={() => q.refetch()} retrying={q.isFetching} />;
  const tasks = q.data?.tasks ?? [];
  const open = tasks.filter((t) => t.state !== "done" && t.state !== "skipped");
  const closed = tasks.filter((t) => t.state === "done" || t.state === "skipped").slice(0, 3);
  if (!tasks.length) {
    return (
      <Card>
        <EmptyState
          art={<Syringe className="size-6 text-muted-foreground" aria-hidden />}
          title={isAr ? "ما فيه مواعيد بعد" : "No care dates yet"}
          body={isAr ? `سجّل آخر تطعيم لـ${name} من دفتره، ونذكّرك قبل الجرعة التالية.` : `Record ${name}'s last vaccine from their booklet and we'll remind you before the next dose.`}
        />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <CareList tasks={[...open, ...closed]} isAr={isAr} invalidate={[["cat-care", catId], ["care-agenda"]]} />
    </Card>
  );
}

/** Shown until the owner decorates the card: the card is theirs to make. */
function DesignNudge({ catId, name, isAr }: { catId: string; name: string; isAr: boolean }) {
  return (
    <Link
      href={`/portal/cats/new?cat=${catId}&step=design`}
      className="mesh-bg-rich group relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] border border-border bg-card p-4 shadow-e1 transition-shadow hover:shadow-e2 sm:p-5"
    >
      <span aria-hidden className="flex shrink-0 -space-x-3 rtl:space-x-reverse">
        {["crown", "heart", "star"].map((id, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={id} src={`/brand/stickers/${id}.svg`} alt="" className="size-11 drop-shadow transition-transform group-hover:-translate-y-0.5" style={{ transform: `rotate(${(i - 1) * 12}deg)` }} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{isAr ? `بطاقة ${name} تنتظر لمستك` : `${name}'s card is waiting for your touch`}</span>
        <span className="block text-sm text-muted-foreground">
          {isAr ? "اختر الخلفية والإطار والملصقات — تظهر في المجتمع وفي كل مشاركة." : "Pick the theme, frame and stickers — it shows in the community and every share."}
        </span>
      </span>
      <span className="hidden shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground sm:inline-flex">
        {isAr ? "صمّمها" : "Design it"}
      </span>
    </Link>
  );
}
