"use client";

/**
 * The vet portal shell (MRC-VET-001 §03/§19).
 *
 * The spine is the omnibox, not this chrome: the lookup box sits in the top bar
 * on every screen, focused on load, one keystroke (`/`) away from anywhere. The
 * rail is supporting cast — five destinations, capability-filtered, one level
 * deep. On a counter tablet the rail becomes a thumb-zone tab bar, because the
 * primary device is a shared iPad held one-handed at a busy front desk.
 *
 * Three states this shell owes the user honestly:
 *   • Not signed in → the staff sign-in, carrying where they meant to go.
 *   • Signed in, but not clinic staff → an explanation and a way in, not a wall.
 *   • Clinic paused/suspended/not live → the real reason, in their language.
 *
 * MRC-VET-002 adds the registration pipeline: a clinic (and its staff accounts)
 * can exist long before it is workable. APPROVED is the setup sandbox — inside
 * the shell, under a persistent banner — and LIVE is the full portal. Every
 * earlier status gets a calm, named screen with one next step (R005, R084,
 * R111), never an error.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Clock,
  Loader2,
  LogOut,
  Mail,
  MoreHorizontal,
  RefreshCw,
  ScanLine,
  ShieldOff,
  WifiOff,
} from "lucide-react";
import { Button, Drawer, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useOnline } from "@/lib/offline";
import { Logo } from "@/components/logo";
import { LangToggle, ThemeToggle } from "@/components/toggles";
import { Omnibox } from "@/components/vet/omnibox";
import { CounterLock, EmptyState, OrgSwitcher, RoleBadge } from "@/components/vet/vet-shell-bits";
import { VetActorProvider, useVetActor, vetFriendlyError, type VetMembership } from "@/lib/vet-api";
import { visibleVetNav, type VetNavItem } from "./nav";

/** Routes inside /vet that must work before anyone has an account or a clinic. */
const PUBLIC_ROUTES = ["/vet/login", "/vet/apply", "/vet/invite", "/vet/register"];

/** Clinic partnerships are invitation-only (MRC-VET-002) — this inbox is the door. */
const PARTNERS_EMAIL = "partners@moracat.co";

export default function VetLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isPublic) return <PublicChrome>{children}</PublicChrome>;

  return (
    <VetActorProvider>
      <VetShell>{children}</VetShell>
    </VetActorProvider>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Public chrome — sign-in, invitation page, staff invite, registration       */
/* ────────────────────────────────────────────────────────────────────────── */

function PublicChrome({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 pt-safe sm:px-6">
        <Link href="/vet" aria-label="Moracat" className="flex items-center gap-2">
          <Logo className="h-8" priority />
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
            {isAr ? "بوابة العيادات" : "Partner portal"}
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* The authenticated shell                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function VetShell({ children }: { children: React.ReactNode }) {
  const { user, ready: authReady, logout } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const actor = useVetActor();
  const online = useOnline();
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Not signed in → the staff door, carrying the destination (R117).
  React.useEffect(() => {
    if (!authReady || user) return;
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.replace(`/vet/login?next=${encodeURIComponent(pathname + search)}`);
  }, [authReady, user, router, pathname]);

  const handleLogout = React.useCallback(() => {
    void logout();
    router.push("/vet/login");
  }, [logout, router]);

  // `g` then a key — Linear's go-to grammar, kept for the desk, not the counter.
  const nav = React.useMemo<VetNavItem[]>(
    () => visibleVetNav(actor.can, { counterMode: actor.counterMode }),
    [actor.can, actor.counterMode],
  );
  React.useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      return ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName) || node.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (armed) {
        const item = nav.find((n) => n.shortcut === e.key.toLowerCase());
        armed = false;
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (e.key.toLowerCase() === "g") {
        armed = true;
        clearTimeout(timer);
        timer = setTimeout(() => {
          armed = false;
        }, 1200);
      } else if (e.key.toLowerCase() === "s" && actor.can("patient.search")) {
        e.preventDefault();
        router.push("/vet/scan");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, [nav, router, actor]);

  if (!authReady || !user || !actor.ready) return <ShellSkeleton isAr={isAr} />;

  // Couldn't reach the membership context at all — a recovery, never a wall.
  if (actor.error && actor.memberships.length === 0) {
    return (
      <BlockedShell isAr={isAr} onLogout={handleLogout}>
        <EmptyState
          icon={RefreshCw}
          title={vetFriendlyError(actor.error, isAr).title}
          body={vetFriendlyError(actor.error, isAr).message}
          action={
            <Button size="sm" variant="outline" onClick={() => void actor.refresh()} loading={actor.loading}>
              <RefreshCw className="size-4" aria-hidden />
              {isAr ? "أعد المحاولة" : "Try again"}
            </Button>
          }
        />
      </BlockedShell>
    );
  }

  // Signed in, but this person isn't on any clinic team yet.
  if (actor.memberships.length === 0) {
    return (
      <BlockedShell isAr={isAr} onLogout={handleLogout}>
        <EmptyState
          icon={Building2}
          tone="boundary"
          title={isAr ? "هذا الحساب ليس ضمن فريق عيادة بعد" : "This account isn't on a clinic team yet"}
          body={
            isAr
              ? "اطلب من مدير عيادتك دعوتك — تأخذ عشرين ثانية ويصلك الرابط على بريدك. شراكات العيادات مع مرقط بالدعوة فقط؛ للاستفسار راسل فريق الشراكات."
              : "Ask your clinic manager to invite you — it takes twenty seconds and the link arrives by email. Clinic partnerships with Moracat are by invitation; to ask about one, write to the partnerships team."
          }
          action={<PartnersContact isAr={isAr} />}
        />
      </BlockedShell>
    );
  }

  // The clinic (or this person's seat in it) isn't serving a counter right now.
  // APPROVED (setup sandbox) and LIVE are the only statuses the API lets into
  // the shell; every other status gets its own honest screen.
  const blocked = actor.org ? blockedCopy(actor.org, isAr) : null;
  if (blocked) {
    return (
      <BlockedShell isAr={isAr} onLogout={handleLogout}>
        <EmptyState
          icon={blocked.icon}
          tone="boundary"
          title={blocked.title}
          body={blocked.body}
          action={
            blocked.action || actor.memberships.length > 1 ? (
              <div className="flex flex-col items-center gap-3 pt-1">
                {blocked.action}
                {actor.memberships.length > 1 && <OrgSwitcher />}
              </div>
            ) : null
          }
        />
      </BlockedShell>
    );
  }
  const inSetup = actor.org?.org.status === "APPROVED";

  const isActive = (item: VetNavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const primary = nav.filter((i) => i.primary);
  const secondary = nav.filter((i) => !i.primary);

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Rail: daily work, capability-filtered, never greyed-out noise ── */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-primary p-3 pt-safe text-primary-foreground lg:flex">
        <Link href="/vet" aria-label="Moracat" className="mb-6 flex items-center gap-2 px-2 pt-1">
          <Logo className="h-8" priority onDark />
        </Link>
        <p className="px-2 pb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-primary-foreground/60">
          {isAr ? "بوابة العيادات" : "Partner portal"}
        </p>
        <nav className="flex flex-1 flex-col gap-0.5" aria-label={isAr ? "التنقل" : "Navigation"}>
          {nav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-foreground/[0.14] text-primary-foreground"
                    : "text-primary-foreground/85 hover:bg-primary-foreground/[0.07] hover:text-primary-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{isAr ? item.ar : item.en}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-2 border-t border-primary-foreground/15 pt-2">
          <p className="truncate px-3 pb-1 text-[0.6875rem] text-primary-foreground/70">
            {user.firstName ?? user.email}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-primary-foreground/85 transition-colors hover:bg-primary-foreground/[0.07] hover:text-primary-foreground"
          >
            <LogOut className="size-4" aria-hidden />
            {isAr ? "تسجيل الخروج" : "Log out"}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 pt-safe backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
            <Link href="/vet" aria-label="Moracat" className="flex shrink-0 lg:hidden">
              <Logo className="h-7" priority />
            </Link>

            {/* The spine. Everything else in this bar defers to it. */}
            <Omnibox className="mx-auto max-w-2xl flex-1" autoFocus />

            <Button
              size="sm"
              variant="brand"
              onClick={() => router.push("/vet/scan")}
              className="shrink-0"
              aria-label={isAr ? "افتح الماسح" : "Open the scanner"}
            >
              <ScanLine className="size-4" aria-hidden />
              <span className="hidden sm:inline">{isAr ? "مسح" : "Scan"}</span>
            </Button>

            <div className="hidden shrink-0 items-center gap-2 xl:flex">
              <OrgSwitcher />
              <RoleBadge role={actor.role} counterMode={actor.counterMode} />
            </div>
            <div className="hidden shrink-0 items-center gap-1 md:flex">
              <CounterLock />
              <LangToggle />
              <ThemeToggle />
            </div>

            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-label={isAr ? "المزيد" : "More"}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          </div>

          {/* Clinic identity stays visible on narrow screens too — the org header
              on every call is not a detail staff should have to guess at. */}
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-1.5 xl:hidden">
            <OrgSwitcher className="min-w-0 flex-1" />
            <RoleBadge role={actor.role} counterMode={actor.counterMode} />
          </div>
        </header>

        {!online && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 border-b border-border bg-muted px-4 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            <WifiOff className="size-3.5 shrink-0" aria-hidden />
            {/* Offline verification does not exist yet — see scan/page.tsx. */}
            {isAr
              ? "لا يوجد اتصال — التحقق يحتاج الشبكة، ونعيد المحاولة تلقائياً عند عودته."
              : "Offline — verification needs the network; we'll retry automatically."}
          </div>
        )}

        {/* Setup sandbox (MRC-VET-002 phase 5): say what's closed and why, once,
            quietly, everywhere — so a 403 on a record is never a surprise (R084). */}
        {inSetup && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-b border-info/25 bg-info/[0.07] px-4 py-1.5 text-center text-xs"
          >
            <ClipboardCheck className="size-3.5 shrink-0 text-info" aria-hidden />
            <span className="font-medium">
              {isAr ? "وضع التجهيز — سجلات الأعضاء تُفتح بعد التفعيل" : "Setup mode — member records open after go-live"}
            </span>
            {pathname !== "/vet" && (
              <Link
                href="/vet#go-live"
                className="inline-flex min-h-[32px] items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
              >
                {isAr ? "قائمة التجهيز" : "Setup checklist"}
                <ArrowRight className="size-3 rtl:rotate-180" aria-hidden />
              </Link>
            )}
          </div>
        )}

        <main id="main" tabIndex={-1} className="pb-nav flex-1 p-3 outline-none sm:p-4 lg:pb-6 lg:p-6">
          {children}
        </main>
      </div>

      {/* ── Counter tablet / phone: thumb-zone tabs (R100), 56px targets ── */}
      <nav
        aria-label={isAr ? "التنقل" : "Navigation"}
        className="glass bottom-safe ps-safe pe-safe fixed inset-x-3 z-40 grid auto-cols-fr grid-flow-col items-stretch gap-0.5 rounded-[1.75rem] p-1.5 lg:hidden"
      >
        {primary.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-[1.35rem] py-1.5 text-[0.625rem] font-medium leading-none transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="size-[18px] shrink-0" aria-hidden />
              <span className="max-w-full truncate">{isAr ? item.ar : item.en}</span>
            </Link>
          );
        })}
        {secondary.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              "flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-[1.35rem] py-1.5 text-[0.625rem] font-medium leading-none transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              secondary.some(isActive) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal className="size-[18px] shrink-0" aria-hidden />
            <span>{isAr ? "المزيد" : "More"}</span>
          </button>
        )}
      </nav>

      <Drawer open={moreOpen} onClose={() => setMoreOpen(false)} title={isAr ? "المزيد" : "More"}>
        <div className="grid gap-2">
          {secondary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className="flex min-h-[52px] items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{isAr ? item.ar : item.en}</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
          <CounterLock />
          <div className="flex items-center gap-1">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMoreOpen(false);
            handleLogout();
          }}
          className="mt-2 flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-4" aria-hidden />
          {isAr ? "تسجيل الخروج" : "Log out"}
        </button>
      </Drawer>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

type BlockedCopy = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
};

/**
 * Why this membership can't open the shell right now — or null when it can.
 * The clinic's lifecycle is checked before the person's seat, because "your
 * clinic is under review" is the truer answer than "your access is paused".
 */
function blockedCopy(m: VetMembership, isAr: boolean): BlockedCopy | null {
  const status = m.org.status;
  const isOwner = m.role === "OWNER";

  if (status === "SUSPENDED" || status === "PAUSED" || m.org.suspended) {
    return {
      icon: ShieldOff,
      title: isAr ? "وصول هذه العيادة متوقف" : "This clinic's access has stopped",
      body: isAr
        ? "تواصل مع فريق شراكات مرقط لمعرفة السبب وإعادة التفعيل — سجلات العيادة محفوظة كما هي."
        : "Contact the Moracat partnerships team to find out why and restore it — the clinic's records are untouched.",
      action: <PartnersContact isAr={isAr} />,
    };
  }
  if (status === "OFFBOARDED") {
    return {
      icon: ShieldOff,
      title: isAr ? "انتهى وصول هذه العيادة" : "This clinic's access has ended",
      body: isAr
        ? "غادرت العيادة شبكة مرقط. للاستفسار عن السجلات أو العودة، راسل فريق الشراكات."
        : "The clinic has left the Moracat network. For questions about its records, or to return, write to the partnerships team.",
      action: <PartnersContact isAr={isAr} />,
    };
  }
  if (status === "INVITED" || status === "REGISTERING" || status === "CHANGES_REQUESTED") {
    const changes = status === "CHANGES_REQUESTED";
    if (isOwner) {
      return {
        icon: ClipboardCheck,
        title: changes
          ? isAr
            ? "طلبت مرقط بعض التعديلات"
            : "Moracat asked for a few changes"
          : isAr
            ? "أكمل تسجيل عيادتك"
            : "Finish your clinic registration",
        body: changes
          ? isAr
            ? "اقرأ ملاحظة فريق المراجعة، وعدّل الأقسام المفتوحة، ثم أعد الإرسال. كل ما أدخلته محفوظ."
            : "Read the review team's note, update the reopened sections, then submit again. Everything you entered is saved."
          : isAr
            ? "بياناتك محفوظة من حيث توقفت. بعد الإرسال تراجعها مرقط، ثم تُفتح البوابة لفريقك."
            : "Everything is saved where you left off. Once you submit, Moracat reviews it — then the portal opens for your team.",
        action: (
          <Link href="/vet/register">
            <Button size="sm">
              {changes ? (isAr ? "راجع التعديلات" : "Review the changes") : isAr ? "تابع التسجيل" : "Continue registration"}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Button>
          </Link>
        ),
      };
    }
    return {
      icon: Clock,
      title: isAr ? "العيادة تُكمل تسجيلها" : "Your clinic is finishing its registration",
      body: isAr
        ? "حسابك جاهز. سنرسل لك بريداً حين تفعّل مرقط العيادة — لا شيء مطلوب منك الآن."
        : "Your account is ready. We'll email you when Moracat switches the clinic on — nothing is needed from you right now.",
    };
  }
  if (status === "SUBMITTED" || status === "IN_REVIEW") {
    return {
      icon: Clock,
      title: isAr ? "العيادة قيد المراجعة لدى مرقط" : "Under review by Moracat",
      body: isOwner
        ? isAr
          ? "وصلنا طلبك ونراجع المستندات بأنفسنا. سنراسلك بالنتيجة، ويمكنك متابعة حالة الطلب في أي وقت."
          : "We have your registration and are checking the documents ourselves. We'll email you the outcome, and you can follow its status any time."
        : isAr
          ? "حسابك جاهز. العيادة قيد المراجعة لدى مرقط، وسنرسل لك بريداً حين تُفعَّل."
          : "Your account is ready. The clinic is under review by Moracat — we'll email you when it's live.",
      action: isOwner ? (
        <Link href="/vet/register">
          <Button size="sm" variant="outline">
            {isAr ? "تابع حالة الطلب" : "Track the registration"}
          </Button>
        </Link>
      ) : undefined,
    };
  }
  if (status === "REJECTED") {
    return {
      icon: ShieldOff,
      title: isAr ? "لم يُعتمد تسجيل العيادة" : "The clinic's registration wasn't approved",
      body: isOwner
        ? isAr
          ? "أرسلنا لك السبب على بريدك. إن كان لديك ما يوضّح الوضع، راسل فريق الشراكات."
          : "We've emailed you the reason. If there's something we should know, write to the partnerships team."
        : isAr
          ? "لن تُفتح بوابة هذه العيادة. لأي استفسار تحدّث مع مالك العيادة."
          : "This clinic's portal won't open. For questions, speak to the clinic owner.",
      action: isOwner ? <PartnersContact isAr={isAr} /> : undefined,
    };
  }
  if (status !== "APPROVED" && status !== "LIVE") {
    // Legacy lifecycle values (APPLIED, SIGNED, ONBOARDING) — pre-registration
    // clinics the partnerships team moves across by hand.
    return {
      icon: Building2,
      title: isAr ? "العيادة لم تُفعَّل بعد" : "This clinic isn't live yet",
      body: isAr
        ? "فريق شراكات مرقط يُكمل تجهيز هذه العيادة. سجلات العيادة محفوظة كما هي."
        : "The Moracat partnerships team is finishing this clinic's setup. The clinic's records are untouched.",
      action: <PartnersContact isAr={isAr} />,
    };
  }

  // The clinic is workable — now the person's own seat.
  if (m.status === "INVITED") {
    return {
      icon: Mail,
      title: isAr ? "بقي قبول الدعوة" : "Accept your invitation first",
      body: isAr
        ? "افتح رابط الدعوة من بريدك ووافق على تعهّد السرية — بعدها تدخل العيادة مباشرة. انتهت صلاحيته؟ اطلب من مدير العيادة إعادة إرساله."
        : "Open the invitation link in your email and accept the confidentiality undertaking — then you're straight in. Expired? Ask a clinic manager to resend it.",
    };
  }
  if (m.status !== "ACTIVE") {
    return {
      icon: Building2,
      title: isAr ? "حسابك في هذه العيادة موقوف" : "Your access to this clinic is paused",
      body: isAr
        ? "مدير العيادة يستطيع إعادة تفعيله في ثوانٍ. لم يُحذف شيء من سجلك."
        : "A clinic manager can restore it in seconds. Nothing in your record was deleted.",
    };
  }
  return null;
}

/** Invitation-only: the partnerships inbox is the door, not a public form. */
function PartnersContact({ isAr }: { isAr: boolean }) {
  return (
    <a
      href={`mailto:${PARTNERS_EMAIL}`}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Mail className="size-4 shrink-0" aria-hidden />
      <span>{isAr ? "راسل فريق الشراكات" : "Email partnerships"}</span>
      <span dir="ltr" className="text-xs text-muted-foreground">
        {PARTNERS_EMAIL}
      </span>
    </a>
  );
}

/** Mirrors the real layout while memberships resolve — never a naked spinner. */
function ShellSkeleton({ isAr }: { isAr: boolean }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-56 shrink-0 bg-primary lg:block" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <div className="mx-auto h-11 w-full max-w-2xl animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span role="status">{isAr ? "نجهّز عيادتك…" : "Opening your clinic…"}</span>
        </div>
      </div>
    </div>
  );
}

/** A calm full-page state for the cases where work can't start yet. */
function BlockedShell({
  isAr,
  onLogout,
  children,
}: {
  isAr: boolean;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 pt-safe sm:px-6">
        <Link href="/vet" aria-label="Moracat" className="flex items-center gap-2">
          <Logo className="h-8" priority />
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
            {isAr ? "بوابة العيادات" : "Partner portal"}
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <LangToggle />
          <ThemeToggle />
          <button
            type="button"
            onClick={onLogout}
            className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isAr ? "تسجيل الخروج" : "Log out"}
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="grid flex-1 place-items-center p-4 outline-none">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
