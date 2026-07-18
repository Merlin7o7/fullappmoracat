"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Loader2, Pencil, ShieldCheck, Cat as CatIcon } from "lucide-react";
import { Card, Button, Dialog, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";
import { PhotoUploader } from "@/components/photo-uploader";
import { CatIdCeremony, type ShareChoice } from "@/components/cat-id-ceremony";
import { CatIdCard } from "@/components/cat-id-card";
import { CatOnboardingJourney } from "@/components/cat-onboarding-journey";
import { IlloPaw, IlloHeart, Sticker } from "@/components/illustrations";
import { useCats, type PortalCat } from "@/lib/cat-context";

/**
 * Issuing a Cat ID — the cat's name comes FIRST, and almost nothing else is
 * asked (R016, R002; Dossier north star: under two minutes, under six inputs).
 * Everything optional is postponed and invited later as a benefit to the cat
 * (`?cat=<id>` opens the same page as the "complete the file" form).
 * Never a form for form's sake: the live card preview turns typing the name
 * into watching the identity take shape.
 */
export default function NewCatPage() {
  return (
    <React.Suspense fallback={<div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <NewCatInner />
    </React.Suspense>
  );
}

function NewCatInner() {
  const params = useSearchParams();
  const completeCatId = params.get("cat");
  return completeCatId ? <CompleteFileForm catId={completeCatId} /> : <IssueIdFlow />;
}

/* ══ The issue flow · name → contact → ceremony ═══════════════════════════ */

function IssueIdFlow() {
  const router = useRouter();
  const { authedFetch, user, updateUser } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const { cats } = useCats();

  const [step, setStep] = React.useState<0 | 1>(0);
  const [ceremonyCat, setCeremonyCat] = React.useState<PortalCat | null>(null);
  // First-ever Cat ID → after the ceremony, route through the one-time welcome.
  const [firstIssue, setFirstIssue] = React.useState(false);
  // Duplicate-name guard (R115): pause, don't block — two Simbas is allowed,
  // but never by accident.
  const [dupConfirmOpen, setDupConfirmOpen] = React.useState(false);
  const [f, setF] = React.useState({
    name: "",
    photoUrl: "",
    gender: "UNKNOWN",
    ownerName: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    ownerPhone: user?.phone ?? "",
  });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));
  // When the account already carries a name + number, the contact step
  // collapses into step 1: one screen, one action (R002/R005). Captured once
  // on mount so typing never flips the layout underfoot.
  const [singleScreen] = React.useState(
    () => Boolean((user?.firstName || user?.lastName) && user?.phone)
  );
  const [editContact, setEditContact] = React.useState(false);

  // The name they typed on the landing page follows them here (R016) —
  // they should never have to say it twice (R117).
  React.useEffect(() => {
    try {
      const pending = sessionStorage.getItem("moraqat.pendingCatName");
      if (pending) {
        setF((s) => (s.name ? s : { ...s, name: pending }));
        sessionStorage.removeItem("moraqat.pendingCatName");
      }
    } catch { /* ignore */ }
  }, []);

  // The emergency contact is one of the Cat ID's four jobs (safety — "bring my
  // cat home"). A failed save must never be swallowed: it retries quietly in
  // the background and, if it still can't land, says so honestly with where to
  // fix it (R112/R115 — prevent > apologise, never pretend it saved).
  const retryTimer = React.useRef<number | null>(null);
  React.useEffect(() => () => { if (retryTimer.current) window.clearTimeout(retryTimer.current); }, []);
  const saveOwnerContact = React.useCallback(
    async (attempt: number): Promise<void> => {
      const parts = f.ownerName.trim().split(/\s+/);
      try {
        await authedFetch("/account/profile", {
          method: "PATCH",
          body: JSON.stringify({
            firstName: parts[0] || undefined,
            lastName: parts.slice(1).join(" ") || undefined,
            ...(f.ownerPhone.trim() ? { phone: f.ownerPhone.trim() } : {}),
          }),
        });
        if (attempt > 0) {
          toast({ title: isAr ? "تم حفظ رقم التواصل" : "Contact number saved", variant: "success" });
        }
      } catch {
        if (attempt === 0) {
          toast({
            title: isAr ? "ما قدرنا نحفظ رقم التواصل" : "Couldn't save your contact number",
            description: isAr ? "هوية قطك سليمة — نعيد المحاولة الآن." : "Your cat's ID is safe — retrying now.",
            variant: "error",
          });
        }
        if (attempt < 2) {
          retryTimer.current = window.setTimeout(() => void saveOwnerContact(attempt + 1), 4000);
        } else {
          toast({
            title: isAr ? "رقم التواصل لم يُحفظ" : "Your contact number didn't save",
            description: isAr
              ? "أضفه من الإعدادات › حسابي متى ما ناسبك — هو اللي يرجّع قطك لو ضاع."
              : "Add it from Settings › Account when you can — it's what brings your cat home.",
            variant: "error",
          });
        }
      }
    },
    [authedFetch, f.ownerName, f.ownerPhone, isAr, toast]
  );

  const create = useMutation({
    mutationFn: async () => {
      // Save owner edits to the account first (never enter twice) — but never
      // let a profile hiccup block the Cat ID: the save is non-blocking and
      // self-retries, surfacing honestly if it can't land.
      const parts = f.ownerName.trim().split(/\s+/);
      if (f.ownerName.trim() || f.ownerPhone.trim()) {
        void saveOwnerContact(0);
        updateUser({ firstName: parts[0] || user?.firstName, lastName: parts.slice(1).join(" ") || user?.lastName, phone: f.ownerPhone.trim() || user?.phone });
      }
      return authedFetch<PortalCat & { firstCatIdIssued?: boolean }>("/cats", {
        method: "POST",
        body: JSON.stringify({
          name: f.name.trim(),
          gender: f.gender,
          photoUrl: f.photoUrl.trim() || undefined,
        }),
      });
    },
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["cats"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setFirstIssue(Boolean(cat.firstCatIdIssued));
      setCeremonyCat(cat); // the reveal — then the welcome (first time) or the cats page
    },
    onError: (e: Error) => toast({ title: isAr ? "تعذّر إصدار الهوية" : "Couldn't issue the Cat ID", description: e.message, variant: "error" }),
  });

  const catName = f.name.trim();
  // Another living, active cat already carrying this exact name?
  const duplicateName = React.useMemo(
    () => cats.some((c) => c.status === "ACTIVE" && c.name.trim().toLowerCase() === catName.toLowerCase()),
    [cats, catName]
  );
  // The member's first name — offered in the ceremony's share fork ("appear as
  // my first name"). Prefer what they just typed; fall back to the account.
  const ownerFirstName = f.ownerName.trim().split(/\s+/)[0] || user?.firstName || "";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative mb-8">
        <IlloPaw tone="butter" className="pointer-events-none absolute -top-3 end-0 size-10 rotate-[14deg] opacity-40" />
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {catName
            ? (isAr ? `هوية ${catName} تبدأ هنا` : `${catName}'s ID starts here`)
            : (isAr ? "هوية قطك تبدأ هنا" : "Your cat's ID starts here")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr ? "اسمه أولاً — وكل شي ثاني يقدر ينتظر" : "Their name first — everything else can wait"}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <Card className="p-6 sm:p-7">
          {/* Two quiet dots — the whole journey is visible at a glance (R005).
              When the account already knows the owner, there is only one screen
              and the dots would be noise (R002). */}
          {!singleScreen && (
            <div className="mb-6 flex items-center gap-2" aria-hidden>
              {[0, 1].map((i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i === step ? "w-8 bg-primary" : "w-1.5 bg-border", i < step && "bg-primary/40")} />
              ))}
              <span className="ms-2 text-xs text-muted-foreground">
                {step === 0 ? (isAr ? "قطك" : "Your cat") : (isAr ? "التواصل" : "Contact")} · {step + 1}/2
              </span>
            </div>
          )}

          {singleScreen ? (
            /* One screen, one action: the account already carries the owner's
               name + number, so we recognise instead of re-ask (R001/R002). */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!catName || create.isPending) return;
                if (duplicateName) setDupConfirmOpen(true);
                else create.mutate();
              }}
              className="flex flex-col gap-4"
            >
              <Field
                label={isAr ? "وش اسم قطك؟" : "What's your cat's name?"}
                required
                value={f.name}
                onChange={(v) => set({ name: v.slice(0, 60) })}
                placeholder={isAr ? "مثلاً: سمسم" : "e.g. Simba"}
                autoFocus
                hint={f.name.length >= 50 ? `${f.name.length}/60` : undefined}
              />
              <SelectField
                label={isAr ? "الجنس (اختياري)" : "Sex (optional)"}
                value={f.gender}
                onChange={(v) => set({ gender: v })}
                options={[
                  { value: "UNKNOWN", label: isAr ? "غير محدد" : "Not sure" },
                  { value: "MALE", label: isAr ? "ذكر" : "Male" },
                  { value: "FEMALE", label: isAr ? "أنثى" : "Female" },
                ]}
              />
              <PhotoUploader
                endpoint="/uploads/image"
                aspect={1}
                rounded
                maxEdge={800}
                currentUrl={f.photoUrl || null}
                isAr={isAr}
                label={isAr ? "صورته (اختياري — تطلع على الهوية)" : "Photo (optional — it goes on the ID)"}
                onUploaded={(res) => set({ photoUrl: (res.url as string) ?? "" })}
              />

              {/* Recognition, not a form (R001): we already know who's behind
                  this cat — one quiet line, editable in place. */}
              {editContact ? (
                <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-3">
                  <Field label={isAr ? "اسمك الكامل" : "Your full name"} required value={f.ownerName} onChange={(v) => set({ ownerName: v })} />
                  <Field label={isAr ? "رقم جوالك" : "Your mobile number"} value={f.ownerPhone} onChange={(v) => set({ ownerPhone: v })} inputMode="tel" />
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="min-w-0 truncate">
                    {isAr ? "وجدناك: " : "We found you: "}
                    <span className="font-medium text-foreground">{f.ownerName}</span>
                    {f.ownerPhone && <> · <span className="font-medium text-foreground" dir="ltr">{f.ownerPhone}</span></>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditContact(true)}
                    aria-label={isAr ? "تعديل بيانات التواصل" : "Edit your contact details"}
                    className="grid size-11 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                </p>
              )}
              {/* Trust precedes the ask (R004): why the number matters. */}
              <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                {isAr
                  ? `لو ضاع ${catName || "قطك"} يوم من الأيام، هذا الرقم اللي يوصله له اللي يلقاه.`
                  : `If ${catName || "your cat"} is ever lost, this is the number that brings them home.`}
              </p>

              <div className="mt-2 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/portal/cats")} disabled={create.isPending}>
                  <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" size="lg" disabled={!catName || create.isPending}>
                  {create.isPending ? (
                    <><Loader2 className="size-4 animate-spin" /> {isAr ? "جارٍ إصدار الهوية…" : "Issuing the ID…"}</>
                  ) : (
                    <><CatIcon className="size-4" /> {isAr ? `أصدر هوية ${catName || "القط"}` : catName ? `Issue ${catName}'s Cat ID` : "Issue the Cat ID"}</>
                  )}
                </Button>
              </div>
            </form>
          ) : step === 0 ? (
            <form onSubmit={(e) => { e.preventDefault(); if (catName) setStep(1); }} className="flex flex-col gap-4">
              <Field
                label={isAr ? "وش اسم قطك؟" : "What's your cat's name?"}
                required
                value={f.name}
                onChange={(v) => set({ name: v.slice(0, 60) })}
                placeholder={isAr ? "مثلاً: سمسم" : "e.g. Simba"}
                autoFocus
                // Quiet counter only once the name runs long — 60 is the cap.
                hint={f.name.length >= 50 ? `${f.name.length}/60` : undefined}
              />
              <SelectField
                label={isAr ? "الجنس (اختياري)" : "Sex (optional)"}
                value={f.gender}
                onChange={(v) => set({ gender: v })}
                options={[
                  { value: "UNKNOWN", label: isAr ? "غير محدد" : "Not sure" },
                  { value: "MALE", label: isAr ? "ذكر" : "Male" },
                  { value: "FEMALE", label: isAr ? "أنثى" : "Female" },
                ]}
              />
              <PhotoUploader
                endpoint="/uploads/image"
                aspect={1}
                rounded
                maxEdge={800}
                currentUrl={f.photoUrl || null}
                isAr={isAr}
                label={isAr ? "صورته (اختياري — تطلع على الهوية)" : "Photo (optional — it goes on the ID)"}
                onUploaded={(res) => set({ photoUrl: (res.url as string) ?? "" })}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/portal/cats")}>
                  <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" size="lg" disabled={!catName}>
                  {isAr ? "التالي" : "Next"} <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Prevent, don't apologise (R115): a second cat with the same
                // name is fine on purpose, never by accident.
                if (duplicateName) setDupConfirmOpen(true);
                else create.mutate();
              }}
              className="flex flex-col gap-4"
            >
              <Field label={isAr ? "اسمك الكامل" : "Your full name"} required value={f.ownerName} onChange={(v) => set({ ownerName: v })} />
              <Field label={isAr ? "رقم جوالك" : "Your mobile number"} value={f.ownerPhone} onChange={(v) => set({ ownerPhone: v })} inputMode="tel" />
              {/* Trust precedes the ask (R004): say plainly why we want a number. */}
              <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                {isAr
                  ? `لو ضاع ${catName || "قطك"} يوم من الأيام، هذا الرقم اللي يوصله له اللي يلقاه.`
                  : `If ${catName || "your cat"} is ever lost, this is the number that brings them home.`}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(0)} disabled={create.isPending}>
                  <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "رجوع" : "Back"}
                </Button>
                <Button type="submit" size="lg" disabled={!catName || create.isPending}>
                  {create.isPending ? (
                    // The wait has a purpose, and it says so (R119).
                    <><Loader2 className="size-4 animate-spin" /> {isAr ? "جارٍ إصدار الهوية…" : "Issuing the ID…"}</>
                  ) : (
                    <><CatIcon className="size-4" /> {isAr ? `أصدر هوية ${catName || "القط"}` : catName ? `Issue ${catName}'s Cat ID` : "Issue the Cat ID"}</>
                  )}
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* The identity taking shape, live — the same card from the landing page,
            about to become real (R035). */}
        <div className="relative mx-auto w-full max-w-xs lg:sticky lg:top-24">
          <Sticker rotate={12} float className="-end-4 -top-5 hidden sm:block">
            <IlloHeart tone="pink" className="size-8" />
          </Sticker>
          <CatIdCard
            catName={catName || (isAr ? "قطك" : "Your cat")}
            catIdNumber="MRC-····-····"
            photoUrl={f.photoUrl.trim() || null}
            gender={f.gender === "UNKNOWN" ? undefined : f.gender}
            isAr={isAr}
            preview
          />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {isAr ? "رقمه الحقيقي ينطبع لحظة الإصدار" : "The real number is stamped the moment it's issued"}
          </p>
        </div>
      </div>

      {/* Same-name pause (R115/R116): confirm on purpose, never trap. */}
      <Dialog
        open={dupConfirmOpen}
        onClose={() => setDupConfirmOpen(false)}
        title={isAr ? `عندك قط اسمه ${catName}` : `You already have a cat named ${catName}`}
        description={isAr ? "تبي تسوي هوية ثانية بنفس الاسم؟" : "Create another with the same name?"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDupConfirmOpen(false)}>
              {isAr ? "لا، بعدّل الاسم" : "No, I'll change the name"}
            </Button>
            <Button onClick={() => { setDupConfirmOpen(false); create.mutate(); }}>
              {isAr ? "نعم، أصدر هوية ثانية" : "Yes, issue another ID"}
            </Button>
          </>
        }
      />

      {/* The ceremony only ever opens on a real, created cat with a real number
          (set in create.onSuccess) — never on hope (R115/R117). */}
      {ceremonyCat?.catIdNumber && (
        <CatIdCeremony
          cat={{ name: ceremonyCat.name, catIdNumber: ceremonyCat.catIdNumber, idIssuedAt: ceremonyCat.idIssuedAt, photoUrl: ceremonyCat.photoUrl, qrToken: ceremonyCat.qrToken }}
          isAr={isAr}
          // The full rite is for the household's first ID; every next family
          // member gets the warm, familiar mini welcome (R031/R009).
          variant={firstIssue ? "full" : "mini"}
          ownerFirstName={ownerFirstName || null}
          onShareChoice={
            firstIssue
              ? async (choice: ShareChoice) => {
                  const body: Record<string, unknown> = { isPublic: choice.public };
                  if (choice.public) {
                    // PDPL attestation gathered inside the ceremony (R106);
                    // the server stamps shareConsentAt itself.
                    body.consent = true;
                    body.showOwnerName = choice.appearance != null && choice.appearance !== "anonymous";
                    if (choice.nickname) body.ownerNickname = choice.nickname;
                  }
                  // No catch here on purpose: a failure must reach the ceremony
                  // so it can say so and offer a retry — never close pretending
                  // the choice was saved (R115/R117).
                  await authedFetch(`/cats/${ceremonyCat.id}/visibility`, {
                    method: "PATCH",
                    body: JSON.stringify(body),
                  });
                  qc.invalidateQueries({ queryKey: ["visibility", ceremonyCat.id] });
                }
              : undefined
          }
          onClose={() =>
            // After the reveal, every new Cat ID flows into the Product Intro →
            // questionnaire wizard (/portal/subscribe): first we explain that
            // Moracat is a monthly care subscription (the Cat ID is one included
            // benefit), THEN we find their plan from a few questions. This is the
            // core value moment — the subscription is the product (R004). (The
            // legacy /portal/welcome celebration page still exists as a route but
            // is no longer the forced post-issue stop.)
            router.push(`/portal/subscribe?cat=${ceremonyCat.id}`)
          }
        />
      )}
    </div>
  );
}

/* ══ The invited follow-up · the "welcome a family member" journey ═════════ */

/**
 * The postponed profile (R002/R017), reimagined. What used to be a three-card
 * form is now a chaptered, emotional experience — personality, favourites,
 * health, fun, and card personalisation — with a live personalised Cat ID, a
 * gentle completeness ring, recognition badges, and one restrained celebration.
 * All of it lives in `CatOnboardingJourney`; this stays a thin route wrapper so
 * the page file exports only its default component (engineering convention).
 */
function CompleteFileForm({ catId }: { catId: string }) {
  return <CatOnboardingJourney catId={catId} />;
}
