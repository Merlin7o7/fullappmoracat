"use client";

/**
 * The registration wizard once the owner account exists (MRC-VET-002 phase 2).
 *
 * The server's `RegistrationState` is the single source of truth: every save
 * returns the whole thing and replaces what we hold, and "is this step done?"
 * is answered by the same `gaps` the API uses to accept a submission — so the
 * stepper can never say done while the submit button says no.
 */

import * as React from "react";
import { Check, Lock, RefreshCw } from "lucide-react";
import { Button, Skeleton, cn } from "@moraqat/ui";
import { REGISTRATION_STEPS } from "@moraqat/core";
import { registrationError, useRegistrationApi, type RegFriendlyError, type RegistrationState } from "@/lib/vet-registration";
import { IlloPaw } from "@/components/illustrations";
import { StepBranches } from "./step-branches";
import { StepClinic } from "./step-clinic";
import { StepDocuments } from "./step-documents";
import { StepTeam } from "./step-team";
import { StepTerms } from "./step-terms";
import {
  ApprovedScreen,
  ChangesRequestedBanner,
  LiveScreen,
  OtherStatusScreen,
  RejectedScreen,
  UnderReviewScreen,
} from "./status-screens";
import { BranchesSummary, ClinicSummary, DocumentsSummary, SummaryCard, TeamSummary } from "./summary";
import { ActionBar, Centered, ErrorNote } from "./ui";
import { WIZARD_STEPS, type StepProps, type WizardStep } from "./types";

const stepStoreKey = (orgId: string) => `mrc.vet-register.step.${orgId}`;

function readStoredStep(orgId: string): WizardStep | null {
  try {
    const v = window.sessionStorage.getItem(stepStoreKey(orgId));
    return v && (WIZARD_STEPS as string[]).includes(v) ? (v as WizardStep) : null;
  } catch {
    return null;
  }
}

function initialStep(state: RegistrationState, orgId: string): WizardStep {
  const editable = state.editableSteps as WizardStep[];
  const stored = readStoredStep(orgId);
  if (stored && WIZARD_STEPS.includes(stored)) return stored;
  if (state.org.status === "CHANGES_REQUESTED") {
    const reopened = WIZARD_STEPS.find((s) => state.org.changesRequestedSteps.includes(s));
    if (reopened) return reopened;
  }
  return WIZARD_STEPS.find((s) => s !== "terms" && editable.includes(s) && state.gaps.some((g) => g.step === s)) ?? "terms";
}

export function RegistrationWizard({ orgId, isAr }: { orgId: string; isAr: boolean }) {
  const api = useRegistrationApi();
  const [state, setState] = React.useState<RegistrationState | null>(null);
  const [loadError, setLoadError] = React.useState<RegFriendlyError | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setState(await api.state(orgId));
    } catch (err) {
      setLoadError(registrationError(err, isAr));
    } finally {
      setLoading(false);
    }
    // isAr only shapes error copy; re-fetching on a language switch is pointless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, orgId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!state) {
    if (loadError && !loading) {
      return (
        <Centered>
          <ErrorNote error={loadError} className="w-full text-start" />
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw aria-hidden />
            {isAr ? "حاول مجدداً" : "Try again"}
          </Button>
        </Centered>
      );
    }
    return <WizardSkeleton isAr={isAr} />;
  }

  const status = state.org.status;
  const wrap = (node: React.ReactNode) => <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-10">{node}</div>;

  switch (status) {
    case "SUBMITTED":
    case "IN_REVIEW":
      return wrap(<UnderReviewScreen state={state} isAr={isAr} api={api} orgId={orgId} />);
    case "APPROVED":
      return wrap(<ApprovedScreen state={state} isAr={isAr} />);
    case "LIVE":
      return wrap(<LiveScreen state={state} isAr={isAr} />);
    case "REJECTED":
      return wrap(<RejectedScreen state={state} isAr={isAr} />);
    case "INVITED":
    case "REGISTERING":
    case "CHANGES_REQUESTED":
      return <Wizard key={orgId} orgId={orgId} isAr={isAr} state={state} setState={setState} />;
    default:
      return wrap(<OtherStatusScreen state={state} isAr={isAr} />);
  }
}

function Wizard({
  orgId,
  isAr,
  state,
  setState,
}: {
  orgId: string;
  isAr: boolean;
  state: RegistrationState;
  setState: (s: RegistrationState) => void;
}) {
  const api = useRegistrationApi();
  const [step, setStep] = React.useState<WizardStep>(() => initialStep(state, orgId));
  const headingRef = React.useRef<HTMLDivElement>(null);
  const firstRender = React.useRef(true);

  const goTo = React.useCallback(
    (next: WizardStep) => {
      setStep(next);
      try {
        window.sessionStorage.setItem(stepStoreKey(orgId), next);
      } catch {
        /* ignore */
      }
    },
    [orgId]
  );

  // Move focus and scroll to the new step — a screen-reader user hears where they are.
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const index = WIZARD_STEPS.indexOf(step);
  const prev = index > 0 ? WIZARD_STEPS[index - 1] : undefined;
  const next = WIZARD_STEPS[index + 1];
  const editable = (state.editableSteps as WizardStep[]).includes(step);

  const props: StepProps = {
    orgId,
    state,
    api,
    isAr,
    onState: setState,
    onNext: () => next && goTo(next),
    onBack: prev ? () => goTo(prev) : undefined,
    goTo,
  };

  const name = isAr ? state.org.nameAr || state.org.nameEn : state.org.nameEn || state.org.nameAr;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-6 sm:pb-16 sm:pt-10">
      <div className="relative mb-6 flex flex-col gap-1">
        <IlloPaw tone="peach" className="pointer-events-none absolute -top-2 end-0 hidden size-10 rotate-12 sm:block" />
        <p className="text-xs font-medium text-muted-foreground">{isAr ? "تسجيل عيادة شريكة" : "Partner clinic registration"}</p>
        <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{name || (isAr ? "عيادتكم" : "Your clinic")}</h1>
      </div>

      <Stepper state={state} step={step} isAr={isAr} onSelect={goTo} />

      {state.org.status === "CHANGES_REQUESTED" && (
        <div className="mt-5">
          <ChangesRequestedBanner state={state} isAr={isAr} />
        </div>
      )}

      <div ref={headingRef} tabIndex={-1} className="mt-6 outline-none">
        {!editable ? (
          <LockedStep step={step} {...props} />
        ) : step === "clinic" ? (
          <StepClinic key="clinic" {...props} />
        ) : step === "branches" ? (
          <StepBranches key="branches" {...props} />
        ) : step === "documents" ? (
          <StepDocuments key="documents" {...props} />
        ) : step === "team" ? (
          <StepTeam key="team" {...props} />
        ) : (
          <StepTerms key="terms" {...props} />
        )}
      </div>
    </div>
  );
}

/* ── Stepper ───────────────────────────────────────────────────────────── */

function Stepper({
  state,
  step,
  isAr,
  onSelect,
}: {
  state: RegistrationState;
  step: WizardStep;
  isAr: boolean;
  onSelect: (s: WizardStep) => void;
}) {
  const all = REGISTRATION_STEPS; // includes "account", always done here
  const currentIndex = all.findIndex((s) => s.key === step);
  const doneCount = all.filter((s) => s.key === "account" || (s.key !== "terms" && !state.gaps.some((g) => g.step === s.key))).length;
  const listRef = React.useRef<HTMLOListElement>(null);

  // Keep the current pill in view on narrow screens.
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [step]);

  return (
    <nav aria-label={isAr ? "خطوات التسجيل" : "Registration steps"} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {isAr ? `الخطوة ${currentIndex + 1} من ${all.length}` : `Step ${currentIndex + 1} of ${all.length}`}
        </span>
        <span>{isAr ? `${doneCount} مكتملة` : `${doneCount} complete`}</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={all.length}
        aria-valuenow={doneCount}
        aria-label={isAr ? "التقدّم" : "Progress"}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(doneCount / all.length) * 100}%` }} />
      </div>
      <ol ref={listRef} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {all.map((s, i) => {
          const isAccount = s.key === "account";
          const key = s.key as WizardStep;
          const current = s.key === step;
          const done = isAccount || (s.key !== "terms" && !state.gaps.some((g) => g.step === s.key));
          const locked = !isAccount && !state.editableSteps.includes(s.key);
          const label = isAr ? s.ar : s.en;
          const inner = (
            <>
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular",
                  current ? "bg-primary text-primary-foreground" : done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                )}
                aria-hidden
              >
                {done && !current ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="whitespace-nowrap">{label}</span>
              {locked && <Lock className="size-3 text-muted-foreground" aria-hidden />}
              <span className="sr-only">
                {done ? (isAr ? " — مكتملة" : " — complete") : ""}
                {locked ? (isAr ? " — للاطلاع فقط" : " — read-only") : ""}
              </span>
            </>
          );
          const cls = cn(
            "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
            current ? "border-primary/50 bg-primary/[0.07] text-foreground" : "border-border text-muted-foreground"
          );
          return (
            <li key={s.key}>
              {isAccount ? (
                <span className={cn(cls, "opacity-80")}>{inner}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(key)}
                  aria-current={current ? "step" : undefined}
                  className={cn(cls, "hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ── A step that wasn't reopened for changes ───────────────────────────── */

function LockedStep({ step, state, api, orgId, isAr, onNext, onBack }: StepProps & { step: WizardStep }) {
  const meta = REGISTRATION_STEPS.find((s) => s.key === step);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">
          {isAr
            ? "هذا القسم للاطلاع فقط — لم يطلب فريق المراجعة تعديله. إن كان فيه ما يحتاج تغييراً، راسلنا على partners@moracat.co."
            : "This section is read-only — the review team didn't ask for changes here. If something in it needs updating, write to partners@moracat.co."}
        </p>
      </div>
      <SummaryCard step={step} isAr={isAr} state={state}>
        {step === "clinic" && <ClinicSummary state={state} isAr={isAr} />}
        {step === "branches" && <BranchesSummary state={state} isAr={isAr} />}
        {step === "documents" && <DocumentsSummary state={state} isAr={isAr} api={api} orgId={orgId} />}
        {step === "team" && <TeamSummary state={state} isAr={isAr} />}
        {step === "terms" && <p className="text-sm text-muted-foreground">{meta ? (isAr ? meta.hintAr : meta.hintEn) : null}</p>}
      </SummaryCard>
      <ActionBar isAr={isAr} onBack={onBack} onPrimary={onNext} primaryLabel={isAr ? "التالي" : "Next"} />
    </div>
  );
}

function WizardSkeleton({ isAr }: { isAr: boolean }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10" role="status" aria-label={isAr ? "نحمّل التسجيل…" : "Loading your registration…"}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-2 h-8 w-64" />
      <Skeleton className="mt-6 h-1.5 w-full" />
      <div className="mt-3 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-8 h-72 w-full rounded-2xl" />
    </div>
  );
}
