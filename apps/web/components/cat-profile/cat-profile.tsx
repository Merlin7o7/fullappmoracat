"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Siren } from "lucide-react";
import { Card, Ledger, LedgerRow, Skeleton, StatusTag } from "@moraqat/ui";
import { ageInMonths, catVerb, formatAge, formatDate, formatRelative, qrValueFor, saudiCityLabel } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import type { PortalCat } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { keepsakeLine, keepsakeMoment } from "@/lib/keepsake";
import { SITE_URL } from "@/lib/share-url";
import type { HealthRecord } from "@/components/cat-health-record";
import { MomentShare } from "@/components/moments/moment-share";
import { CatSectionTabs } from "./section-tabs";
import { CompleteFile } from "./complete-file";
import { CardHero } from "./card-hero";
import { nextCareItem, useCatCare } from "./cat-care";

/**
 * The cat's profile — the flagship of the product.
 *
 * Audit 2026-10-04 (Problem 7, Page-by-page «Cat profile»): the page was
 * ~4,300px on a phone, the card buried in its third screen, every tab's
 * content duplicated above the tabs. Now, in order:
 *
 *   1. the Cat ID — large, live, tappable; share/print/Wallet in a sheet
 *   2. «{name} الآن» — a short Now ledger: next care, safety, and one
 *      upcoming occasion (birthday / anniversary → «عام {name}»)
 *   3. the tabs — each owns its content (care + weight + record → السجل
 *      الصحي; album → حياته; lost mode + visibility → الأمان)
 *
 * The cat is the hero (P09): the card IS the cat's identity; the person only
 * appears where the cat needs them.
 */
export function CatProfile({ cat, isAr }: { cat: PortalCat; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const loc = isAr ? "ar" : "en";
  const name = localizeName(cat.name, loc);
  // Non-blocking: feeds the collar edition's allergies and «كمّل ملفه».
  const health = useQuery({
    queryKey: ["cat-health", cat.id],
    queryFn: () => authedFetch<HealthRecord>(`/cats/${cat.id}/health`),
    enabled: !!user,
  });

  const facts = [
    cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : null,
    formatAge(ageInMonths(cat.birthDate), loc),
    cat.gender === "MALE" ? (isAr ? "ذكر" : "Male") : cat.gender === "FEMALE" ? (isAr ? "أنثى" : "Female") : null,
    cat.cityCode ? saudiCityLabel(cat.cityCode, loc) : null,
  ].filter(Boolean) as string[];

  const lost = !!cat.lostModeAt;
  // The lost poster points at the finder page (never the marketing landing);
  // the link in the message text carries src=poster for attribution only.
  const finderUrl = cat.qrToken ? qrValueFor(SITE_URL, cat.qrToken) : null;
  const finderLink = finderUrl ? `${finderUrl}?src=poster` : SITE_URL;

  return (
    <div className="space-y-6">
      <Link href="/portal" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {isAr ? "قططي" : "My cats"}
      </Link>

      {lost && (
        <div className="space-y-2">
          <Link
            href={`/portal/cats/${cat.id}/privacy`}
            className="flex items-center gap-3 rounded-md bg-destructive px-4 py-3 text-destructive-foreground"
          >
            <Siren className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{isAr ? `وضع البحث عن ${name} مفعّل` : `${name} is marked lost`}</span>
              <span className="block text-sm opacity-90">
                {isAr ? "كل من يمسح الرمز يرى طلب المساعدة. افتح للتحديث أو الإيقاف." : "Anyone who scans the tag sees your call for help. Open to update or end it."}
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
              isAr
                ? catVerb(cat.gender, { m: "مفقود منذ ", f: "مفقودة منذ ", n: "تاريخ الفقد " }) + formatDate(cat.lostModeAt!, "ar", "medium")
                : `Missing since ${formatDate(cat.lostModeAt!, "en", "medium")}`,
            ]}
            qrUrl={finderUrl}
            shareText={
              isAr
                ? catVerb(cat.gender, {
                    m: `${name} مفقود — لو شفته امسح الرمز في الصورة أو افتح ${finderLink}`,
                    f: `${name} مفقودة — لو شفتها امسح الرمز في الصورة أو افتح ${finderLink}`,
                    n: `نبحث عن ${name} — إن رأيت القطة في الصورة امسح الرمز أو افتح ${finderLink}`,
                  })
                : `${name} is missing — if you see them, scan the code in the image or open ${finderLink}`
            }
            label={isAr ? "شارك ملصق البحث" : "Share the missing poster"}
            variant="destructive"
            size="md"
            className="w-full sm:w-auto"
          />
        </div>
      )}

      {/* ── 1 · The Cat ID, then who this is ───────────────────────────────── */}
      <section aria-labelledby="cat-name" className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <CardHero cat={cat} isAr={isAr} allergies={health.data?.cat.allergies} />

        <div className="space-y-5">
          <div className="space-y-1.5">
            {cat.status === "DECEASED" && <StatusTag tone="neutral">{isAr ? "في الذاكرة" : "In memoriam"}</StatusTag>}
            {cat.status === "ARCHIVED" && <StatusTag tone="neutral">{isAr ? "مؤرشف" : "Archived"}</StatusTag>}
            <div className="flex items-start justify-between gap-3">
              <h1 id="cat-name" className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
                {name}
              </h1>
              <Link
                href={`/portal/cats/${cat.id}/edit`}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary hover:bg-primary/[0.07]"
              >
                <Pencil className="size-4" aria-hidden /> {isAr ? "تعديل" : "Edit"}
              </Link>
            </div>
            {facts.length > 0 && <p className="text-muted-foreground">{facts.join(" · ")}</p>}
            {cat.idIssuedAt && (
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? `في سجل مرقط منذ ${formatDate(cat.idIssuedAt, "ar", "monthYear")} · الرقم التسلسلي ${cat.catNumber}`
                  : `In the Moracat register since ${formatDate(cat.idIssuedAt, "en", "monthYear")} · serial ${cat.catNumber}`}
              </p>
            )}
          </div>

          {/* ── 2 · Now ──────────────────────────────────────────────────── */}
          <NowLedger cat={cat} name={name} isAr={isAr} />
        </div>
      </section>

      {/* ── 3 · The tabs — each owns its content ──────────────────────────── */}
      <CatSectionTabs catId={cat.id} isAr={isAr} />

      {health.data && <CompleteFile cat={cat} record={health.data} isAr={isAr} />}
    </div>
  );
}

/**
 * «{name} الآن» — three answers in one glance: what needs doing, is the cat
 * safe, and what's coming. Each row is a door to the tab that owns it.
 */
function NowLedger({ cat, name, isAr }: { cat: PortalCat; name: string; isAr: boolean }) {
  const loc = isAr ? "ar" : "en";
  const care = useCatCare(cat.id);
  const next = nextCareItem(care.data?.tasks);
  const moment = cat.status === "ACTIVE" ? keepsakeMoment(cat) : null;
  const lost = !!cat.lostModeAt;
  const base = `/portal/cats/${cat.id}`;
  const link = "inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline";

  return (
    <section aria-labelledby="now-title" className="space-y-2">
      <h2 id="now-title" className="font-display text-2xl">{isAr ? `${name} الآن` : `${name} now`}</h2>
      <Card className="px-5 py-1">
        <Ledger>
          <LedgerRow
            label={isAr ? "الرعاية القادمة" : "Next care"}
            value={
              care.isLoading ? (
                <Skeleton className="inline-block h-4 w-28" />
              ) : care.isError ? (
                <button type="button" onClick={() => care.refetch()} className={link}>
                  {isAr ? "تعذّر التحميل — أعد المحاولة" : "Couldn't load — retry"}
                </button>
              ) : next ? (
                <Link href={`${base}/health#care`} className={link}>{isAr ? next.title.ar : next.title.en}</Link>
              ) : (
                <Link href={`${base}/health#care`} className={link}>{isAr ? "لا شيء مستحق" : "Nothing due"}</Link>
              )
            }
            hint={
              next
                ? next.state === "overdue"
                  ? isAr ? `متأخر — كان موعده ${formatRelative(next.dueAt, loc)}` : `Overdue — it was due ${formatRelative(next.dueAt, loc)}`
                  : formatRelative(next.dueAt, loc)
                : undefined
            }
          />
          <LedgerRow
            label={isAr ? "الأمان" : "Safety"}
            value={
              <Link href={`${base}/privacy`} className="inline-flex min-h-11 items-center">
                {lost ? (
                  <StatusTag tone="critical">{isAr ? "وضع البحث مفعّل" : "Lost mode on"}</StatusTag>
                ) : cat.qrToken ? (
                  <StatusTag tone="positive">{isAr ? "رمز الطوق فعّال" : "Collar code active"}</StatusTag>
                ) : (
                  <StatusTag tone="neutral">{isAr ? "بلا رمز بعد" : "No code yet"}</StatusTag>
                )}
              </Link>
            }
            hint={
              lost
                ? isAr ? "من يمسح الرمز يرى طلب المساعدة" : "Scanners see your call for help"
                : cat.qrToken
                  ? isAr ? "من يجده يمسح الرمز ويوصلك عبر مرقط" : "A finder scans it and reaches you via Moracat"
                  : undefined
            }
          />
          {moment && (
            <LedgerRow
              label={isAr ? "قريباً" : "Coming up"}
              value={
                <Link href={`${base}/year/${moment.year}`} className={link}>
                  {isAr ? `عام ${name} ${moment.year}` : `${name}'s ${moment.year}`}
                </Link>
              }
              hint={keepsakeLine(moment, name, isAr)}
            />
          )}
        </Ledger>
      </Card>
    </section>
  );
}
