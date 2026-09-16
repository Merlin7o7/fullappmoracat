"use client";

/**
 * The go-live checklist (MRC-VET-002 phase 5) — the first thing an APPROVED
 * clinic sees on Today. Dossier §18: "Welcome to the partner network. A few
 * steps and your counter is live." — the onboarding checklist with progress.
 *
 * Every item says what it is, whether it's done, and the ONE thing to do next
 * (R005). Nothing is invented: counts come from GET /vet/org/onboarding, and
 * when the demo cat hasn't been seeded we say so and name who fixes it, rather
 * than letting a clinic hunt for a cat that doesn't exist (R006, R084).
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Rocket, ScanLine } from "lucide-react";
import { Badge, Button, Card, Skeleton, cn, useToast } from "@moraqat/ui";
import { GO_LIVE_ITEMS, type GoLiveItem } from "@moraqat/core";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { useVetActor, useVetFetch } from "@/lib/vet-api";
import type { OnboardingState } from "@/lib/vet-registration";
import { InlineError } from "@/components/vet/settings/confirm-dialog";
import { settingsError } from "@/components/vet/settings/errors";
import { useOnboarding, useSetOnboarding } from "@/components/vet/settings/use-onboarding";

const PARTNERS_EMAIL = "partners@moracat.co";

export function GoLiveChecklist({ className }: { className?: string }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const { toast } = useToast();
  const vetFetch = useVetFetch();
  const { can } = useVetActor();
  const query = useOnboarding();
  const setOnboarding = useSetOnboarding();

  const [busy, setBusy] = React.useState<"branches" | "golive" | null>(null);
  const [error, setError] = React.useState<{ title: string; message: string } | null>(null);

  async function post(path: string, kind: "branches" | "golive") {
    setBusy(kind);
    setError(null);
    try {
      const state = await vetFetch<OnboardingState>(path, { method: "POST", body: "{}" });
      setOnboarding(state);
      toast(
        kind === "branches"
          ? {
              title: isAr ? "أُكّدت بيانات الفروع" : "Branch details confirmed",
              variant: "success",
            }
          : {
              title: isAr ? "وصل طلبك لمرقط" : "Moracat has your request",
              description: isAr
                ? "نراجع قائمة التجهيز ونفعّل العيادة، ثم نرسل للفريق بريداً."
                : "We'll check the list, switch the clinic live, and email the team.",
              variant: "success",
            },
      );
    } catch (err) {
      setError(settingsError(err, isAr));
    } finally {
      setBusy(null);
    }
  }

  const data = query.data;
  const required = GO_LIVE_ITEMS.filter((i) => i.required);
  const doneRequired = data ? required.filter((i) => data.items[i.key].done).length : 0;
  const pct = required.length ? Math.round((doneRequired / required.length) * 100) : 0;

  return (
    <Card id="go-live" className={cn("scroll-mt-32 overflow-hidden p-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold leading-tight">
            <Rocket className="size-5 shrink-0 text-primary" aria-hidden />
            {isAr ? "خطوات قليلة ويعمل الكاونتر" : "A few steps and your counter is live"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "اعتمدت مرقط عيادتكم — أهلاً بكم في الشبكة. أكملوا هذه القائمة، وتُفتح سجلات الأعضاء بعد التفعيل."
              : "Moracat has approved your clinic — welcome to the network. Finish this list and member records open once you're live."}
          </p>
        </div>
        {data && (
          <Badge variant={data.ready ? "success" : "secondary"} className="tabular">
            {isAr
              ? `${doneRequired.toLocaleString("ar-SA")} من ${required.length.toLocaleString("ar-SA")} مطلوبة`
              : `${doneRequired} of ${required.length} required`}
          </Badge>
        )}
      </div>

      {data && (
        <div
          className="h-1 bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={isAr ? "تقدّم التجهيز" : "Setup progress"}
        >
          <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      <div className="p-2 sm:p-3">
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-2">
            {GO_LIVE_ITEMS.map((i) => (
              <div key={i.key} className="flex items-center gap-3">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-3.5 w-48" />
              </div>
            ))}
          </div>
        ) : query.isError || !data ? (
          <div className="flex flex-col items-start gap-2 p-3">
            <InlineError error={settingsError(query.error, isAr)} />
            <Button size="sm" variant="outline" onClick={() => void query.refetch()} loading={query.isFetching}>
              {isAr ? "أعد المحاولة" : "Try again"}
            </Button>
          </div>
        ) : (
          <ol className="flex flex-col">
            {GO_LIVE_ITEMS.map((item) => (
              <ChecklistRow
                key={item.key}
                title={isAr ? item.ar : item.en}
                hint={isAr ? item.hintAr : item.hintEn}
                optional={!item.required}
                done={data.items[item.key].done}
                isAr={isAr}
              >
                {renderDetail(item.key)}
              </ChecklistRow>
            ))}
          </ol>
        )}
      </div>

      {data && (
        <div className="flex flex-col gap-2 border-t border-border/70 bg-muted/30 px-4 py-3">
          {data.goLiveRequestedAt ? (
            <p className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>
                {isAr
                  ? `طلبتم التفعيل في ${formatDate(data.goLiveRequestedAt, loc)}. تراجع مرقط القائمة الآن، وسنرسل للفريق بريداً حين تصبح العيادة فعّالة.`
                  : `You asked to go live on ${formatDate(data.goLiveRequestedAt, loc)}. Moracat is checking the list now — we'll email the team the moment the clinic is live.`}
              </span>
            </p>
          ) : data.ready ? (
            can("settings.manage") ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {isAr ? "كل البنود المطلوبة مكتملة." : "Every required item is done."}
                </p>
                <Button variant="brand" onClick={() => void post("/vet/org/onboarding/request-go-live", "golive")} loading={busy === "golive"}>
                  <Rocket className="size-4" aria-hidden />
                  {isAr ? "اطلب من مرقط تفعيل العيادة" : "Ask Moracat to switch us live"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "القائمة مكتملة — مالك العيادة أو مديرها يطلب التفعيل من مرقط."
                  : "The list is complete — the clinic owner or manager asks Moracat to switch you live."}
              </p>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "زر طلب التفعيل يظهر هنا حين تكتمل البنود المطلوبة."
                : "The go-live request appears here once the required items are done."}
            </p>
          )}
          <InlineError error={error} />
        </div>
      )}
    </Card>
  );

  function renderDetail(key: GoLiveItem): React.ReactNode {
    if (!data) return null;
    switch (key) {
      case "branches": {
        const it = data.items.branches;
        if (it.done) {
          return it.at
            ? isAr
              ? `أُكّدت في ${formatDate(it.at, loc)}`
              : `Confirmed ${formatDate(it.at, loc)}`
            : null;
        }
        if (!can("branch.manage")) {
          return isAr ? "يؤكدها مالك العيادة أو مديرها." : "The clinic owner or manager confirms these.";
        }
        return (
          <span className="flex flex-wrap items-center gap-2">
            <StepLink href="/vet/settings#branches">{isAr ? "راجع الفروع" : "Review branches"}</StepLink>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void post("/vet/org/onboarding/confirm-branches", "branches")}
              loading={busy === "branches"}
            >
              {isAr ? "أكّد الفروع" : "Confirm branches"}
            </Button>
          </span>
        );
      }
      case "device": {
        const it = data.items.device;
        const summary = it.done
          ? isAr
            ? `${it.count.toLocaleString("ar-SA")} ${it.count === 1 ? "جهاز مسجّل" : "أجهزة مسجّلة"}`
            : `${it.count} registered`
          : null;
        return (
          <span className="flex flex-wrap items-center gap-2">
            {summary && <span>{summary}</span>}
            {can("device.manage") ? (
              <StepLink href="/vet/settings#devices">
                {it.done ? (isAr ? "إدارة الأجهزة" : "Manage devices") : isAr ? "سجّل جهاز الاستقبال" : "Register the counter"}
              </StepLink>
            ) : (
              !it.done && <span>{isAr ? "يسجّله مدير العيادة." : "A clinic manager registers it."}</span>
            )}
          </span>
        );
      }
      case "pins": {
        const it = data.items.pins;
        return (
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">
              {isAr
                ? `${it.count.toLocaleString("ar-SA")} من ${it.of.toLocaleString("ar-SA")} عيّنوا رموزهم`
                : `${it.count} of ${it.of} have set a PIN`}
            </span>
            <StepLink href="/vet/settings#pin">{isAr ? "رمزي السري" : "My PIN"}</StepLink>
          </span>
        );
      }
      case "testScan": {
        const it = data.items.testScan;
        if (it.done) {
          return it.at
            ? isAr
              ? `نجح المسح في ${formatDate(it.at, loc)}`
              : `Scanned successfully ${formatDate(it.at, loc)}`
            : null;
        }
        const cat = data.testCat;
        const identifier = cat?.microchipNo ?? cat?.catIdNumber ?? null;
        if (!cat || !identifier) {
          return (
            <span>
              {isAr ? "القطة التجريبية غير مفعّلة بعد — اطلب من مرقط تفعيلها: " : "The demo cat isn't enabled yet — ask Moracat to enable it: "}
              <a href={`mailto:${PARTNERS_EMAIL}`} dir="ltr" className="font-medium text-primary underline-offset-4 hover:underline">
                {PARTNERS_EMAIL}
              </a>
            </span>
          );
        }
        return (
          <span className="flex flex-col gap-2">
            <span>
              {isAr
                ? `امسح بطاقة القطة التجريبية «${cat.name}»، أو اكتب ${cat.microchipNo ? "رقم الشريحة" : "رقم الهوية"} في الماسح:`
                : `Scan the demo cat ${cat.name}'s card, or type the ${cat.microchipNo ? "microchip number" : "Cat ID"} into the scanner:`}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <code dir="ltr" className="select-all rounded-lg bg-muted px-2.5 py-1 font-mono text-sm text-foreground">
                {identifier}
              </code>
              {can("patient.search") && (
                <Link href="/vet/scan">
                  <Button size="sm" variant="brand">
                    <ScanLine className="size-4" aria-hidden />
                    {isAr ? "افتح الماسح" : "Open the scanner"}
                  </Button>
                </Link>
              )}
            </span>
          </span>
        );
      }
      default:
        return null;
    }
  }
}

function ChecklistRow({
  title,
  hint,
  done,
  optional,
  isAr,
  children,
}: {
  title: string;
  hint: string;
  done: boolean;
  optional: boolean;
  isAr: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl px-2 py-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground/60" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("flex flex-wrap items-center gap-2 text-sm font-medium", done && "text-muted-foreground")}>
          <span>{title}</span>
          <span className="sr-only">{done ? (isAr ? "(مكتمل)" : "(done)") : isAr ? "(لم يكتمل)" : "(not done)"}</span>
          {optional && <Badge variant="outline">{isAr ? "اختياري" : "Optional"}</Badge>}
        </p>
        {!done && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        {children && <div className="mt-1.5 text-xs text-muted-foreground">{children}</div>}
      </div>
    </li>
  );
}

function StepLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[40px] items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
    >
      {children}
      <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
