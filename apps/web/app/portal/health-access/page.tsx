"use client";

/**
 * Health access — the owner's consent & access ledger.
 *
 * The thesis of the vet portal is that privacy here is a *visible ledger*, not
 * a promise in a policy page. So this screen answers four questions an owner
 * actually asks, in this order: who can see my cat's record, what exactly does
 * that let them see, how do I stop it, and who has looked so far.
 *
 * Design notes:
 * - Revoking is one tap plus a confirmation that tells the truth about what
 *   revoking does and doesn't do (R116 confirm without trapping, R006 honest).
 * - Granting explains each tier in plain words *before* the decision, never in
 *   a tooltip afterwards (R004 trust precedes the ask).
 * - Emergency (break-glass) grants are shown first and marked loudly with their
 *   stated reason — a break-glass read the owner can't see would be the single
 *   most trust-destroying thing this product could do.
 * - Multi-cat households are first class (R109): the cat switcher is the frame.
 */

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Plus, Search, Clock, Building2, CheckCircle2, MapPin, ArrowRight, History,
} from "lucide-react";
import { Card, Badge, Button, Skeleton, Dialog, useToast, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { formatDate } from "@/lib/datetime";
import { friendlyError } from "@/lib/errors";
import { QueryError } from "@/components/query-error";
import { IlloCat, IlloPaw } from "@/components/illustrations";
import { ConfirmDialog } from "@/app/admin/_components/confirm";
import { AccessLedger } from "./access-ledger";
import {
  type ConsentGrant,
  type VetTier,
  AlwaysVisibleNote,
  CONSENT_ENDPOINTS,
  EmergencyBadge,
  TierBadge,
  TierExplainer,
  isGrantLive,
  orgName,
  tierLabel,
  toConsentResponse,
} from "@/components/vet-consent-card";
import { dedupeByOrg, normalizeDirectory, type DirectoryClinic } from "@/lib/vet-directory";


export default function HealthAccessPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { activeCats, activeCat, setActiveCat, isLoading: catsLoading, isError: catsError, refetch: refetchCats, isFetching: catsFetching } = useCats();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {isAr ? "من يرى سجل قطك" : "Who can see the record"}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "أنت من يقرّر أي عيادة تفتح الملف الطبي، وإلى أي مدى. وكل مرة تُفتح، تجدها مكتوبة هنا."
            : "You decide which clinic can open the medical file, and how far it goes. And every time one does, you'll find it written here."}
        </p>
      </header>

      {catsError ? (
        <QueryError isAr={isAr} onRetry={() => refetchCats()} retrying={catsFetching} />
      ) : catsLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : activeCats.length === 0 ? (
        <NoCatsYet isAr={isAr} />
      ) : (
        <>
          {activeCats.length > 1 && (
            <CatTabs cats={activeCats} activeId={activeCat?.id ?? null} onPick={setActiveCat} isAr={isAr} />
          )}
          {activeCat && (
            // Remount per cat: consent is cat-specific state, and a stale open
            // dialog or expanded section must never carry across a switch.
            <React.Fragment key={activeCat.id}>
              <ConsentSection catId={activeCat.id} catName={activeCat.name} isAr={isAr} />
              <AccessLedger catId={activeCat.id} catName={activeCat.name} isAr={isAr} />
            </React.Fragment>
          )}
        </>
      )}
    </div>
  );
}

function NoCatsYet({ isAr }: { isAr: boolean }) {
  return (
    <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
      <IlloPaw tone="peach" aria-hidden className="pointer-events-none absolute start-8 top-6 size-7 -rotate-12 opacity-50" />
      <IlloCat tone="sage" aria-hidden className="h-16 w-auto" />
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {isAr
          ? "أضف قطك أولاً، وبعدها تقدر تقرّر أي عيادة تفتح سجله الطبي."
          : "Add your cat first — then you can decide which clinics may open their medical record."}
      </p>
      <Link href="/portal/cats/new">
        <Button>{isAr ? "أضف قطي" : "Add my cat"}</Button>
      </Link>
    </Card>
  );
}

/** Segmented cat switcher — the frame for every multi-cat household (R109). */
function CatTabs({
  cats, activeId, onPick, isAr,
}: {
  cats: { id: string; name: string }[];
  activeId: string | null;
  onPick: (id: string) => void;
  isAr: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label={isAr ? "اختر القط" : "Choose a cat"}
      className="flex flex-wrap gap-2"
    >
      {cats.map((c) => {
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPick(c.id)}
            className={cn(
              "min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function ConsentSection({ catId, catName, isAr }: { catId: string; catName: string; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [granting, setGranting] = React.useState(false);
  const [revoking, setRevoking] = React.useState<ConsentGrant | null>(null);
  const [showPast, setShowPast] = React.useState(false);

  const consentKey = ["vet-consent", user?.id, catId];

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: consentKey,
    queryFn: async () => toConsentResponse(await authedFetch<unknown>(CONSENT_ENDPOINTS.list(catId))),
    enabled: !!user && !!catId,
  });

  const revoke = useMutation({
    mutationFn: (grantId: string) =>
      authedFetch(CONSENT_ENDPOINTS.revoke(grantId), { method: "POST", body: "{}" }),
    onSuccess: (_res, grantId) => {
      const g = data?.grants.find((x) => x.id === grantId);
      setRevoking(null);
      void qc.invalidateQueries({ queryKey: ["vet-consent"] });
      toast({
        title: isAr ? "تم إيقاف الوصول" : "Access stopped",
        description: g
          ? isAr
            ? `${orgName(g, isAr)} ما عادت تقدر تفتح سجل ${catName}.`
            : `${orgName(g, isAr)} can no longer open ${catName}'s record.`
          : undefined,
        variant: "success",
      });
    },
    onError: (err) => {
      const f = friendlyError(err, isAr);
      toast({ title: f.title, description: f.message, variant: "error" });
    },
  });

  const { live, past } = React.useMemo(() => {
    const grants = data?.grants ?? [];
    const now = Date.now();
    const liveGrants = grants.filter((g) => isGrantLive(g, now));
    // Emergency grants surface first — they are the ones an owner most needs
    // to see and judge, so they never sit below routine rows.
    liveGrants.sort((a, b) => {
      if (a.emergency !== b.emergency) return a.emergency ? -1 : 1;
      return new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime();
    });
    const pastGrants = grants
      .filter((g) => !isGrantLive(g, now))
      .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
    return { live: liveGrants, past: pastGrants };
  }, [data]);

  return (
    <section aria-labelledby="consent-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="consent-heading" className="font-display text-lg font-semibold">
            {isAr ? "العيادات التي لديها إذن" : "Clinics with permission"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAr ? `أذونات ${catName} الحالية` : `${catName}'s current permissions`}
          </p>
        </div>
        <Button size="sm" onClick={() => setGranting(true)}>
          <Plus aria-hidden className="size-4" />
          {isAr ? "امنح عيادة إذناً" : "Give a clinic access"}
        </Button>
      </div>

      <AlwaysVisibleNote catName={catName} isAr={isAr} />

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : live.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? `لا توجد عيادة لديها إذن بفتح سجل ${catName} الطبي. تقدر تمنح الإذن وقت الزيارة، وتسحبه بعدها بضغطة.`
              : `No clinic has permission to open ${catName}'s medical record. You can give access at the time of a visit, and take it back in one tap afterwards.`}
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {live.map((g) => (
            <li key={g.id}>
              <GrantCard grant={g} catName={catName} isAr={isAr} onRevoke={() => setRevoking(g)} />
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <History aria-hidden className="size-4" />
            {isAr
              ? `أذونات سابقة (${past.length.toLocaleString("ar-SA")})`
              : `Past permissions (${past.length})`}
          </button>
          {showPast && (
            <ul className="mt-3 space-y-3">
              {past.map((g) => (
                <li key={g.id}>
                  <GrantCard grant={g} catName={catName} isAr={isAr} ended />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {granting && (
        <GrantDialog
          catId={catId}
          catName={catName}
          isAr={isAr}
          existingOrgIds={live.map((g) => g.orgId)}
          onClose={() => setGranting(false)}
          onGranted={() => {
            setGranting(false);
            void qc.invalidateQueries({ queryKey: ["vet-consent"] });
          }}
        />
      )}

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
        isAr={isAr}
        destructive
        pending={revoke.isPending}
        title={isAr ? "إيقاف وصول هذه العيادة؟" : "Stop this clinic's access?"}
        description={
          revoking
            ? isAr
              ? `${orgName(revoking, isAr)} ما عادت تقدر تفتح سجل ${catName} الطبي. تبقى ملاحظات هذه العيادة عن ${catName} عندها — الطبيب لا يفقد عمله هو. وتبقى بيانات الهوية والتنبيهات الطبية ظاهرة كالمعتاد. تقدر تمنحها الإذن مرة ثانية في أي وقت.`
              : `${orgName(revoking, isAr)} will no longer be able to open ${catName}'s medical record. Notes this clinic wrote about ${catName} stay with them — a vet never loses their own work. Identity and medical alerts stay visible as always. You can give access again anytime.`
            : undefined
        }
        confirmLabel={isAr ? "أوقف الوصول" : "Stop access"}
        cancelLabel={isAr ? "إبقاء الإذن" : "Keep access"}
      />
    </section>
  );
}

/** One permission, stated in full: who, what it opens, since when, until when. */
function GrantCard({
  grant, catName, isAr, onRevoke, ended = false,
}: {
  grant: ConsentGrant;
  catName: string;
  isAr: boolean;
  onRevoke?: () => void;
  ended?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const expired = !grant.revokedAt && !!grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now();

  return (
    <Card className={cn("p-5", ended && "opacity-80")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{orgName(grant, isAr)}</h3>
            {grant.emergency && <EmergencyBadge isAr={isAr} />}
            <TierBadge tier={grant.tier} isAr={isAr} />
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {isAr
              ? `منذ ${formatDate(grant.grantedAt, "ar")}`
              : `Since ${formatDate(grant.grantedAt, "en")}`}
            {grant.expiresAt && !ended && (
              <>
                {" · "}
                {isAr
                  ? `ينتهي تلقائياً في ${formatDate(grant.expiresAt, "ar")}`
                  : `ends automatically on ${formatDate(grant.expiresAt, "en")}`}
              </>
            )}
          </p>

          {ended && (
            <p className="mt-1 text-sm text-muted-foreground">
              {grant.revokedAt
                ? isAr
                  ? `أوقفتَه في ${formatDate(grant.revokedAt, "ar")}`
                  : `You stopped this on ${formatDate(grant.revokedAt, "en")}`
                : expired && grant.expiresAt
                  ? isAr
                    ? `انتهى تلقائياً في ${formatDate(grant.expiresAt, "ar")}`
                    : `Ended automatically on ${formatDate(grant.expiresAt, "en")}`
                  : null}
            </p>
          )}

          {/* A break-glass read without its reason on screen would be a secret.
              We show the clinic's stated reason verbatim, marked as theirs. */}
          {grant.emergency && (
            <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                {isAr ? "فُتح في حالة طارئة" : "Opened as an emergency"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {grant.reason
                  ? isAr
                    ? `السبب الذي سجّلته العيادة: «${grant.reason}»`
                    : `The reason the clinic recorded: “${grant.reason}”`
                  : isAr
                    ? "لم تسجّل العيادة سبباً. تواصل معنا إذا كان هذا غير متوقع."
                    : "The clinic didn't record a reason. Contact us if this wasn't expected."}
              </p>
            </div>
          )}
        </div>

        {!ended && onRevoke && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRevoke}
            className="min-h-[44px] border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            {isAr ? "أوقف الوصول" : "Stop access"}
          </Button>
        )}
      </div>

      {/* The same plain-language explanation as at grant time — an owner can
          always re-check what they agreed to, without leaving the page. */}
      {(grant.tier === "T1" || grant.tier === "T2") && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {open
              ? isAr ? "إخفاء التفاصيل" : "Hide the details"
              : isAr ? "ما الذي تراه هذه العيادة؟" : "What can this clinic see?"}
          </button>
          {open && (
            <TierExplainer tier={grant.tier} catName={catName} isAr={isAr} className="mt-3 rounded-2xl bg-muted/40 p-4" />
          )}
        </div>
      )}
    </Card>
  );
}

type ExpiryChoice = "none" | "30" | "90";

/**
 * The grant flow: pick a clinic, then choose how far the permission goes.
 * Two steps, because a person deciding *which* clinic and a person deciding
 * *how much* are answering different questions (R005 one clear action).
 */
function GrantDialog({
  catId, catName, isAr, existingOrgIds, onClose, onGranted,
}: {
  catId: string;
  catName: string;
  isAr: boolean;
  existingOrgIds: string[];
  onClose: () => void;
  onGranted: () => void;
}) {
  const { authedFetch } = useAuth();
  const { toast } = useToast();
  const [picked, setPicked] = React.useState<DirectoryClinic | null>(null);
  const [tier, setTier] = React.useState<VetTier>("T1");
  const [expiry, setExpiry] = React.useState<ExpiryChoice>("none");
  const [search, setSearch] = React.useState("");

  const { data: clinics, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["vet-directory-picker", isAr],
    // The endpoint returns one row per BRANCH inside an `{ items }` envelope;
    // consent is granted per clinic, so normalise then collapse to one row per
    // org — otherwise a two-branch clinic would ask the member the same
    // question twice.
    queryFn: async () =>
      dedupeByOrg(normalizeDirectory(await authedFetch<unknown>("/vet/directory"), isAr)),
  });

  const grant = useMutation({
    mutationFn: () => {
      const expiresAt =
        expiry === "none"
          ? undefined
          : new Date(Date.now() + Number(expiry) * 24 * 60 * 60 * 1000).toISOString();
      return authedFetch(CONSENT_ENDPOINTS.create, {
        method: "POST",
        body: JSON.stringify({ catId, orgId: picked!.orgId, tier, ...(expiresAt ? { expiresAt } : {}) }),
      });
    },
    onSuccess: () => {
      toast({
        title: isAr ? "تم منح الإذن" : "Access given",
        description: picked
          ? isAr
            ? `${orgName(picked, isAr)} تقدر الآن تفتح ${tierLabel(tier, isAr)} لـ${catName}.`
            : `${orgName(picked, isAr)} can now open ${catName}'s ${tierLabel(tier, isAr).toLowerCase()}.`
          : undefined,
        variant: "success",
      });
      onGranted();
    },
    onError: (err) => {
      const f = friendlyError(err, isAr);
      toast({ title: f.title, description: f.message, variant: "error" });
    },
  });

  const filtered = React.useMemo(() => {
    const all = (clinics ?? []).filter((c) => !existingOrgIds.includes(c.orgId));
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) =>
      [c.nameAr, c.nameEn, c.city ?? "", c.addressLine ?? ""].some((f) => f.toLowerCase().includes(q))
    );
  }, [clinics, existingOrgIds, search]);

  const expiryOptions: { value: ExpiryChoice; ar: string; en: string; hintAr: string; hintEn: string }[] = [
    {
      value: "none", ar: "حتى أوقفه بنفسي", en: "Until I stop it",
      hintAr: "يبقى الإذن قائماً وتقدر تسحبه أي وقت", hintEn: "Stays on until you take it back",
    },
    {
      value: "30", ar: "٣٠ يوماً", en: "30 days",
      hintAr: "ينتهي تلقائياً بعد شهر", hintEn: "Ends by itself after a month",
    },
    {
      value: "90", ar: "٩٠ يوماً", en: "90 days",
      hintAr: "مناسب لخطة علاج ممتدة", hintEn: "Good for an ongoing course of treatment",
    },
  ];

  // ── Step 2: how far does this permission go? ──────────────────────────────
  if (picked) {
    return (
      <Dialog
        open
        onClose={grant.isPending ? () => {} : onClose}
        title={isAr ? "إلى أي مدى؟" : "How far does it go?"}
        description={
          isAr
            ? `اختر ما تقدر ${orgName(picked, isAr)} تفتحه من سجل ${catName}.`
            : `Choose what ${orgName(picked, isAr)} can open in ${catName}'s record.`
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)} disabled={grant.isPending}>
              {isAr ? "رجوع" : "Back"}
            </Button>
            <Button size="sm" onClick={() => grant.mutate()} loading={grant.isPending}>
              {isAr ? "امنح الإذن" : "Give access"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div role="radiogroup" aria-label={isAr ? "مستوى الإذن" : "Level of access"} className="space-y-3">
            {(["T1", "T2"] as VetTier[]).map((t) => {
              const active = tier === t;
              return (
                <div
                  key={t}
                  className={cn(
                    "rounded-2xl border p-4 transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTier(t)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-medium">{tierLabel(t, isAr)}</span>
                    {active ? (
                      <CheckCircle2 aria-hidden className="size-5 shrink-0 text-primary" />
                    ) : (
                      <span aria-hidden className="size-5 shrink-0 rounded-full border border-input" />
                    )}
                  </button>
                  {/* Always expanded: a person cannot consent to something they
                      have to click to read (R004). */}
                  <TierExplainer tier={t} catName={catName} isAr={isAr} className="mt-3" />
                </div>
              );
            })}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{isAr ? "لمدة كم؟" : "For how long?"}</p>
            <div role="radiogroup" aria-label={isAr ? "مدة الإذن" : "How long access lasts"} className="grid gap-2">
              {expiryOptions.map((o) => {
                const active = expiry === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setExpiry(o.value)}
                    className={cn(
                      "min-h-[44px] rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{isAr ? o.ar : o.en}</span>
                      {active && <CheckCircle2 aria-hidden className="size-4 shrink-0 text-primary" />}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{isAr ? o.hintAr : o.hintEn}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              {isAr
                ? "مهما اخترت، تقدر توقف الإذن بضغطة واحدة قبل انتهاء المدة."
                : "Whatever you choose, you can stop it in one tap before the time is up."}
            </p>
          </div>
        </div>
      </Dialog>
    );
  }

  // ── Step 1: which clinic? ─────────────────────────────────────────────────
  return (
    <Dialog
      open
      onClose={onClose}
      title={isAr ? "أي عيادة؟" : "Which clinic?"}
      description={
        isAr
          ? "العيادات الموثّقة من مرقط فقط — تحققنا من ترخيصها بأنفسنا."
          : "Only clinics verified by Moracat — we've checked their licence ourselves."
      }
      footer={
        <Button variant="ghost" size="sm" onClick={onClose}>
          {isAr ? "إلغاء" : "Cancel"}
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search aria-hidden className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={isAr ? "ابحث عن عيادة" : "Search for a clinic"}
            placeholder={isAr ? "اسم العيادة أو المدينة…" : "Clinic name or city…"}
            className="h-11 w-full rounded-xl border border-input bg-background ps-9 pe-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {isError ? (
          <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search.trim()
              ? isAr ? "ما لقينا عيادة بهذا الاسم." : "No clinic matches that."
              : (clinics ?? []).length > 0
                ? isAr ? "كل العيادات الموثّقة لديها إذن بالفعل." : "Every verified clinic already has access."
                : isAr ? "لا توجد عيادات موثّقة بعد. نضيفها أولاً بأول." : "No verified clinics yet. We're adding them as they join."}
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {filtered.map((c) => (
              <li key={c.orgId}>
                <button
                  type="button"
                  onClick={() => setPicked(c)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-start transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{orgName(c, isAr)}</span>
                      {c.emergency24h && (
                        <Badge variant="destructive">{isAr ? "طوارئ ٢٤ ساعة" : "24h emergency"}</Badge>
                      )}
                    </span>
                    {(c.city || c.addressLine) && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin aria-hidden className="size-3" />
                        {[c.city, c.addressLine].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Building2 aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {isAr
            ? "ما لقيت عيادتك؟ تصفّح دليل العيادات الموثّقة."
            : "Can't find your clinic? Browse the verified directory."}
          <Link href="/vet-directory" className="font-medium text-primary underline-offset-4 hover:underline">
            {isAr ? "الدليل" : "Directory"}
          </Link>
        </p>
      </div>
    </Dialog>
  );
}
