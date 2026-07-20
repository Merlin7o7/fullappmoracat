"use client";

/**
 * The vet portal's small shared furniture (MRC-VET-001 §21 — "the clinical
 * dialect"). Not a new design system: the same paper, the same green, the same
 * primitives from `@moraqat/ui` — one notch denser, one notch calmer, with the
 * whimsy rationed. A clinic at 9am wants certainty, not charm.
 *
 * These are deliberately generic so every portal screen (including ones this
 * file's author doesn't own) can import them and stay consistent.
 */

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, Lock, LockOpen, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Dialog, cn, useToast } from "@moraqat/ui";
import { VET_ROLE_LABELS, type VetRole } from "@moraqat/core";
import { useLocale } from "@/app/providers";
import {
  getVetDeviceId,
  useVetActor,
  useVetApi,
  vetBranchName,
  vetFriendlyError,
  vetOrgName,
} from "@/lib/vet-api";

/* ────────────────────────────────────────────────────────────────────────── */
/* SectionCard — the portal's one content container                           */
/* ────────────────────────────────────────────────────────────────────────── */

export function SectionCard({
  title,
  hint,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string;
  /** One quiet line of context. Never marketing (R081). */
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** A single trailing action — one clear next step per section (R005). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold leading-tight">
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{title}</span>
          </h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* EmptyState — a welcome, never a void (R111)                                */
/* ────────────────────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  tone = "calm",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  /** Say what will fill this space, and why it's empty — honestly. */
  body?: string;
  action?: React.ReactNode;
  className?: string;
  /** `calm` for "nothing yet"; `boundary` for a rule we're choosing to keep. */
  tone?: "calm" | "boundary";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl px-6 py-10 text-center",
        tone === "boundary" ? "bg-info/[0.06]" : "bg-muted/40",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "grid size-11 place-items-center rounded-2xl",
            tone === "boundary" ? "bg-info/12 text-info" : "bg-background text-muted-foreground",
          )}
        >
          <Icon className="size-5" />
        </span>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {body && <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{body}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* RoleBadge — the actor says who they are, always                            */
/* ────────────────────────────────────────────────────────────────────────── */

export function RoleBadge({
  role,
  counterMode,
  className,
}: {
  role: VetRole | null;
  counterMode?: boolean;
  className?: string;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  if (!role) return null;
  const label = VET_ROLE_LABELS[role][isAr ? "ar" : "en"];
  return (
    <Badge
      variant={counterMode ? "info" : "secondary"}
      className={cn("max-w-[10rem] truncate", className)}
      title={label}
    >
      <ShieldCheck className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* OrgSwitcher — which clinic am I speaking for?                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Every call carries an org header; this control is where that header comes
 * from, so it is never hidden in a menu. With one membership it renders as a
 * plain label — a switcher with nothing to switch is just noise.
 */
export function OrgSwitcher({ className }: { className?: string }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { memberships, org, orgId, setOrg, branch, branchId, setBranch } = useVetActor();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const branches = org?.branches ?? [];
  const hasChoice = memberships.length > 1 || branches.length > 1;
  const label = vetOrgName(org, isAr) || (isAr ? "اختر عيادة" : "Choose a clinic");
  const sub = branch ? vetBranchName(branch, isAr) : branches.length > 1 ? (isAr ? "كل الفروع" : "All branches") : null;

  if (!hasChoice) {
    return (
      <div className={cn("min-w-0", className)}>
        <p className="truncate text-sm font-medium leading-tight">{label}</p>
        {branches.length === 1 && (
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            {vetBranchName(branches[0] ?? null, isAr)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 min-w-0 max-w-[15rem] items-center gap-2 rounded-xl border border-border bg-background px-3 text-start transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight">{label}</span>
          {sub && <span className="block truncate text-[0.6875rem] text-muted-foreground">{sub}</span>}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={isAr ? "العيادات" : "Clinics"}
          className="absolute top-[calc(100%+0.35rem)] z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-1.5 shadow-e3 end-0"
        >
          {memberships.length > 1 && (
            <>
              <p className="px-2.5 py-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                {isAr ? "العيادة" : "Clinic"}
              </p>
              {memberships.map((m) => {
                const active = m.org.id === orgId;
                const suspended = m.status !== "ACTIVE";
                return (
                  <button
                    key={m.org.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setOrg(m.org.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm transition-colors",
                      active ? "bg-primary/10 font-medium" : "hover:bg-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{vetOrgName(m, isAr)}</span>
                      <span className="block truncate text-[0.6875rem] text-muted-foreground">
                        {VET_ROLE_LABELS[m.role][isAr ? "ar" : "en"]}
                        {suspended && ` · ${isAr ? "موقوف" : "paused"}`}
                      </span>
                    </span>
                    {active && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                  </button>
                );
              })}
            </>
          )}

          {branches.length > 1 && (
            <>
              <p className="mt-1 px-2.5 py-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                {isAr ? "الفرع" : "Branch"}
              </p>
              <button
                type="button"
                role="option"
                aria-selected={!branchId}
                onClick={() => {
                  setBranch(null);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm transition-colors",
                  !branchId ? "bg-primary/10 font-medium" : "hover:bg-muted",
                )}
              >
                <span className="flex-1 truncate">{isAr ? "كل الفروع" : "All branches"}</span>
                {!branchId && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
              </button>
              {branches.map((b) => {
                const active = b.id === branchId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setBranch(b.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm transition-colors",
                      active ? "bg-primary/10 font-medium" : "hover:bg-muted",
                    )}
                  >
                    <span className="flex-1 truncate">{vetBranchName(b, isAr)}</span>
                    {active && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* CounterLock — the shared-iPad answer (§02)                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The front desk is one tablet used by four people. Fighting that produces
 * shared passwords; designing for it produces accountability. In Counter Mode
 * the active person is named on screen at all times, and the capability matrix
 * silently strips exports, settings and staff management from the session —
 * whatever their role. Locking is always one tap away.
 */
export function CounterLock({ className }: { className?: string }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { toast } = useToast();
  const { counterMode, counterSession, applyCounterSession } = useVetActor();
  const api = useVetApi();

  const [open, setOpen] = React.useState(false);
  const [staffId, setStaffId] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const lock = React.useCallback(async () => {
    setBusy(true);
    try {
      await api.counterLock();
    } catch {
      // Locking must never fail *locally* — the worst case is a stale server
      // session, and leaving the terminal unlocked is the greater harm.
    } finally {
      applyCounterSession(null);
      setBusy(false);
      toast({
        title: isAr ? "أُقفل الكاونتر" : "Counter locked",
        description: isAr ? "الجهاز جاهز للزميل التالي." : "The terminal is ready for the next colleague.",
        variant: "success",
      });
    }
  }, [api, applyCounterSession, isAr, toast]);

  // Auto-lock after two idle minutes (§02). A terminal left open at a busy
  // front desk is an unattributed action waiting to happen.
  React.useEffect(() => {
    if (!counterMode) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void lock(), 2 * 60 * 1000);
    };
    const events: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((ev) => document.addEventListener(ev, arm, { passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((ev) => document.removeEventListener(ev, arm));
    };
  }, [counterMode, lock]);

  const unlock = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const session = await api.counterUnlock({
          deviceId: getVetDeviceId(),
          staffId: staffId.trim(),
          pin: pin.trim(),
        });
        applyCounterSession(session);
        setOpen(false);
        setPin("");
        setStaffId("");
        toast({
          title: isAr ? `أهلاً ${session.staffName}` : `Welcome, ${session.staffName}`,
          description: isAr
            ? "كل إجراء من هذا الجهاز سيُسجَّل باسمك."
            : "Everything done on this terminal is now logged to you.",
          variant: "success",
        });
      } catch (err) {
        setError(vetFriendlyError(err, isAr).message);
        setPin("");
      } finally {
        setBusy(false);
      }
    },
    [api, applyCounterSession, isAr, pin, staffId, toast],
  );

  if (counterMode) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge variant="info" dot className="max-w-[11rem] truncate">
          <span className="truncate">
            {isAr ? "وضع الكاونتر" : "Counter mode"}
            {counterSession?.staffName ? ` · ${counterSession.staffName}` : ""}
          </span>
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void lock()}
          loading={busy}
          aria-label={isAr ? "إقفال الكاونتر" : "Lock the counter"}
        >
          <Lock className="size-4" aria-hidden />
          <span className="hidden sm:inline">{isAr ? "إقفال" : "Lock"}</span>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className={className}
        aria-label={isAr ? "تشغيل وضع الكاونتر" : "Start counter mode"}
      >
        <LockOpen className="size-4" aria-hidden />
        <span className="hidden lg:inline">{isAr ? "وضع الكاونتر" : "Counter mode"}</span>
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
          setPin("");
        }}
        title={isAr ? "وضع الكاونتر" : "Counter mode"}
        description={
          isAr
            ? "جهاز واحد، عدة زملاء. ادخل برقمك ورمزك السري، وسيُسجَّل كل إجراء باسمك — وتُخفى التصدير والإعدادات وإدارة الفريق عن هذا الجهاز."
            : "One terminal, several colleagues. Sign in with your staff number and PIN: every action is logged to you, and exports, settings and staff management stay off this device."
        }
      >
        <form onSubmit={unlock} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {isAr ? "رقم الموظف" : "Staff number"}
            <input
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              autoComplete="off"
              required
              className="h-11 rounded-xl border border-input bg-background px-4 font-mono text-sm shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {isAr ? "الرمز السري" : "PIN"}
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              required
              className="h-13 rounded-xl border border-input bg-background px-4 text-center font-mono text-lg tracking-[0.6em] shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy} className="w-full" size="lg">
            {isAr ? "ابدأ المناوبة" : "Start my shift"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* PatientRow — the recurring "a cat, at a glance" line                       */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The cat is the hero, even in a work tool (R009): photo first, name in the
 * display face, the human-readable ID in mono underneath. Used by Today, the
 * omnibox results and the patients list so a cat looks the same everywhere.
 */
export function PatientRow({
  name,
  catIdNumber,
  photoUrl,
  meta,
  trailing,
  href,
  onClick,
  active,
  size = "md",
  className,
}: {
  name: string;
  catIdNumber?: string | null;
  photoUrl?: string | null;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const avatar = (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-muted-foreground",
        size === "sm" ? "size-9" : "size-11",
      )}
      aria-hidden
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="text-base">🐈</span>
      )}
    </span>
  );

  const body = (
    <>
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-sm font-medium leading-tight">{name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
          {catIdNumber && <span className="font-mono tabular">{catIdNumber}</span>}
          {meta}
        </span>
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </>
  );

  const classes = cn(
    "flex min-h-[56px] w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors",
    active ? "bg-primary/10" : "hover:bg-muted",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  );
}
