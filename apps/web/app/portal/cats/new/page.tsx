"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Globe, Lock, Loader2, Pencil, ShieldCheck, Cat as CatIcon } from "lucide-react";
import { Card, Button, Dialog, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";
import { PhotoUploader } from "@/components/photo-uploader";
import { PhoneField, composePhone } from "@/components/phone-field";
import { CatIdCeremony, type ShareChoice } from "@/components/cat-id-ceremony";
import { CatIdCard } from "@/components/cat-id-card";
import { CatOnboardingJourney } from "@/components/cat-onboarding-journey";
import { IlloPaw, IlloHeart, Sticker } from "@/components/illustrations";
import { useCats, type PortalCat } from "@/lib/cat-context";
import { friendlyMessage } from "@/lib/errors";
import { consumeSource } from "@/lib/source";
import { track } from "@/lib/track";
import { SAUDI_CITIES } from "@moraqat/core";

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

/* ══ The cat's age ════════════════════════════════════════════════════════
 * Asked as an approximation, never as a birthday. Most owners — especially of
 * a rescue — simply don't know the date, and a required date picker would turn
 * a warm question into an exam they can only pass by inventing an answer
 * (R002 effort is the enemy; R040 we shouldn't record precision we don't have).
 *
 * Age is what the product actually consumes: life stage, feeding guidance, and
 * when vaccinations fall due. Months matter for kittens, so both fields exist;
 * for an adult cat, years alone is a complete answer.
 */
function CatAge({
  isAr,
  catName,
  years,
  months,
  onChange,
}: {
  isAr: boolean;
  catName: string;
  years: string;
  months: string;
  onChange: (years: string, months: string) => void;
}) {
  const clamp = (v: string, max: number) => {
    const digits = v.replace(/\D/g, "").slice(0, 2);
    if (digits === "") return "";
    return String(Math.min(Number(digits), max));
  };
  const who = catName || (isAr ? "قطك" : "your cat");

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-foreground/80">
        {isAr ? `كم عمر ${who}؟` : `How old is ${who}?`}{" "}
        <span aria-hidden className="text-destructive">*</span>
      </legend>
      <div className="flex items-end gap-3">
        <label className="flex-1">
          <span className="mb-1.5 block text-xs text-muted-foreground">{isAr ? "سنوات" : "Years"}</span>
          <input
            inputMode="numeric"
            value={years}
            onChange={(e) => onChange(clamp(e.target.value, 25), months)}
            placeholder="0"
            // ≥44px target, real focus ring (R092/R097).
            className="h-12 w-full rounded-xl border border-input bg-card px-4 text-base tabular outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1.5 block text-xs text-muted-foreground">{isAr ? "أشهر" : "Months"}</span>
          <input
            inputMode="numeric"
            value={months}
            onChange={(e) => onChange(years, clamp(e.target.value, 11))}
            placeholder="0"
            className="h-12 w-full rounded-xl border border-input bg-card px-4 text-base tabular outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {isAr
          ? "تقريبي يكفي — نستخدمه لإرشاد التغذية ومواعيد التطعيم، مو للاحتفال بعيد ميلاده."
          : "An estimate is fine — it guides feeding and vaccination timing, not a birthday reminder."}
      </p>
    </fieldset>
  );
}

/* ══ The census city ══════════════════════════════════════════════════════
 * The field whose absence made the Cat ID lie. The founding class is printed
 * on the card, and until this existed it read «دفعة الرياض ٢٠٢٦» for an owner
 * in Jeddah or Makkah (R040).
 *
 * The list is SAUDI_CITIES from packages/core — deliberately NOT the delivery
 * city table, which knows only the two cities we can ship to. The census is a
 * national question and must be answerable from anywhere on day one. The copy
 * therefore says what the city IS used for and carefully does not imply we
 * deliver there, because right now we deliver nowhere.
 */
function CityPicker({
  isAr,
  catName,
  value,
  onChange,
}: {
  isAr: boolean;
  catName: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const who = catName || (isAr ? "قطك" : "your cat");
  return (
    <div className="flex flex-col gap-1.5">
      <SelectField
        label={isAr ? `وين يعيش ${who}؟` : `Where does ${who} live?`}
        required
        value={value}
        onChange={onChange}
        options={[
          { value: "", label: isAr ? "اختر مدينتك…" : "Choose your city…" },
          ...SAUDI_CITIES.map((c) => ({ value: c.code, label: isAr ? c.ar : c.en })),
        ]}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {isAr
          ? "مدينتك تحدد دفعة قطك في التعداد — وبعدين توصلك عيادات الشركاء القريبة منك."
          : "Your city sets your cat's class in the census — and later, which partner clinics are near you."}
      </p>
    </div>
  );
}

/* ══ Waitlist consent ═════════════════════════════════════════════════════
 * Registering a Cat ID means joining the membership waitlist, so we say that
 * here — at the moment of registration, in the person's own words, before the
 * button rather than in a footer nobody reads (R106, PDPL; R004 trust precedes
 * the ask).
 *
 * Unticked by default and entirely optional: the Cat ID is issued either way,
 * and the copy says so. A checkbox that arrives pre-ticked is not consent, and
 * a free identity that quietly costs you your inbox is not free.
 */
function WaitlistConsent({
  isAr,
  checked,
  onChange,
}: {
  isAr: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-border p-3 text-xs leading-relaxed text-muted-foreground transition-colors hover:bg-muted/30 focus-within:ring-2 focus-within:ring-ring">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        // 44px touch target via padding on the label + a real focus ring (R092/R097).
        className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-none"
      />
      <span>
        <span className="font-medium text-foreground">
          {isAr ? "أبلغوني أول ما تفتح العضويات" : "Email me when memberships open"}
        </span>
        <br />
        {isAr
          ? "تسجيل قطك يضيفك لقائمة انتظار العضوية. ما نرسل لك شي إلا إذا وافقت هنا، وتقدر توقف الرسائل في أي وقت. هوية قطك تصدر سواء وافقت أو لا."
          : "Registering your cat adds you to the membership waitlist. We won't email you unless you tick this, and you can stop the emails at any time. Your cat's ID is issued either way."}
      </span>
    </label>
  );
}

/* ══ Community share notice ═══════════════════════════════════════════════
 * Community visibility is opt-out (decision 2026-08-14): the cat joins the
 * community feed by default, anonymously, and only once it has a photo. That
 * default is stated HERE, before the issue button, with the off switch beside
 * it — a default someone can see and flip is a choice, a default in a footer
 * is a trap (R040 honesty, R106 say-so-plainly). This also covers 2nd+ cats,
 * whose mini ceremony has no share stage.
 */
function ShareNotice({
  isAr,
  catName,
  on,
  onChange,
}: {
  isAr: boolean;
  catName: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  const name = catName || (isAr ? "قطك" : "your cat");
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-dashed border-border p-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          {isAr ? "الظهور في مجتمع مرقط" : "Appearing in the Moracat community"}
        </span>
        <br />
        {on
          ? isAr
            ? `${name} بيظهر في مجتمع مرقط مع أول صورة له — بدون اسمك، وتقدر توقف الظهور في أي وقت.`
            : `${name} will appear in the Moracat community once they have a photo — without your name, and you can turn this off anytime.`
          : isAr
            ? `${name} بيبقى خاص. تقدر تشاركه مع المجتمع في أي وقت من صفحته.`
            : `${name} stays private. You can share them with the community anytime from their page.`}
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={isAr ? "الظهور في المجتمع" : "Appear in the community"}
        onClick={() => onChange(!on)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors",
          on ? "bg-primary/10 text-primary ring-primary/30" : "bg-muted text-muted-foreground ring-border"
        )}
      >
        {on ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
        {on ? (isAr ? "عام" : "Public") : (isAr ? "خاص" : "Private")}
      </button>
    </div>
  );
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
    // Empty, not "UNKNOWN": the census needs an answer the owner actually gave.
    // "Not sure" stays a legitimate CHOICE (a rescue's sex may genuinely be
    // unknown) — it just can no longer be a default nobody looked at.
    gender: "",
    // Approximate age. Asked in years+months rather than as a birthday because
    // most owners don't know the date, and life stage / feeding / vaccination
    // timing need the age, not the day (R002 — don't tax people for precision
    // the product never uses).
    ageYears: "",
    ageMonths: "",
    // Census city (SAUDI_CITIES). Required: the founding class on the Cat ID
    // is built from it, and before we asked, the card told every member they
    // belonged to a Riyadh cohort (R040).
    cityCode: "",
    ownerName: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    ownerPhone: user?.phone ?? "",
    ownerDialCode: user?.dialCode ?? "+966",
    // Never pre-ticked. Consent that arrives switched on isn't consent (R106),
    // and the Cat ID is issued whether or not this is checked.
    waitlistConsent: false,
    // Community visibility is opt-out (decision 2026-08-14): sharing is the
    // stated default — disclosed by ShareNotice right above the issue button,
    // never buried. The PDPL people-in-photo attestation is separate: it rides
    // on the affirmative act of uploading a photo (see the uploader helper).
    sharePublicly: true,
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
      // If they already told the feeding calculator how old their cat is, the
      // age field arrives filled — never ask the same question twice (R117).
      // The raw blob is left in place; the create mutation is what consumes
      // and clears it, and it still carries the weight we don't ask for here.
      const rawProfile = sessionStorage.getItem("moraqat.pendingCatProfile");
      if (rawProfile) {
        const carried = JSON.parse(rawProfile) as { ageMonths?: number };
        if (typeof carried.ageMonths === "number" && carried.ageMonths > 0) {
          setF((s) =>
            s.ageYears || s.ageMonths
              ? s
              : {
                  ...s,
                  ageYears: String(Math.floor(carried.ageMonths! / 12)),
                  ageMonths: String(carried.ageMonths! % 12),
                }
          );
        }
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
            ...(f.ownerPhone.trim() ? { phone: composePhone(f.ownerDialCode, f.ownerPhone), dialCode: f.ownerDialCode } : {}),
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
        updateUser({ firstName: parts[0] || user?.firstName, lastName: parts.slice(1).join(" ") || user?.lastName, phone: (f.ownerPhone.trim() ? composePhone(f.ownerDialCode, f.ownerPhone) : user?.phone) });
      }
      // The feeding calculator's bridge promise made true (R002/R117): if the
      // visitor computed a plan there, their cat's weight and age travel here
      // silently — the profile starts filled with what they already told us.
      let carried: { weightKg?: number; ageMonths?: number } = {};
      try {
        const raw = sessionStorage.getItem("moraqat.pendingCatProfile");
        if (raw) carried = JSON.parse(raw) as { weightKg?: number; ageMonths?: number };
      } catch { /* ignore */ }
      // Age → birth date. The age the owner just typed wins over anything the
      // calculator carried, since it's the more recent answer; the same
      // months-to-date conversion is used either way so the two paths can never
      // disagree about what "18 months old" means.
      const months = ageKnown ? ageTotalMonths : carried.ageMonths;
      const birthDate =
        typeof months === "number" && months > 0
          ? new Date(Date.now() - months * 30.44 * 86_400_000).toISOString()
          : undefined;
      // The stand code that started this journey (`?src=stand-004`) lands on the
      // cat row here, at the one moment it can — consumed so a second cat added
      // later in the same session isn't wrongly credited to the stand.
      const sourceCode = consumeSource();
      const cat = await authedFetch<PortalCat & { firstCatIdIssued?: boolean }>("/cats", {
        method: "POST",
        body: JSON.stringify({
          name: f.name.trim(),
          gender: f.gender,
          // Where the cat lives — decides the founding class on their card.
          cityCode: f.cityCode,
          photoUrl: f.photoUrl.trim() || undefined,
          weightKg: typeof carried.weightKg === "number" ? carried.weightKg : undefined,
          birthDate,
          ...(sourceCode ? { sourceCode } : {}),
          // Community visibility is opt-out — the ShareNotice above the button
          // is where this value comes from. The PDPL attestation travels only
          // when a photo was actually uploaded with sharing on: the upload act
          // is the consent signal; the server mints the timestamp (R106).
          sharePublicly: f.sharePublicly,
          ...(f.sharePublicly && f.photoUrl.trim() ? { shareConsent: true } : {}),
        }),
      });
      try { sessionStorage.removeItem("moraqat.pendingCatProfile"); } catch { /* ignore */ }

      // Registering a Cat ID means joining the membership waitlist — so we say
      // so at the point of registration and only act on an explicit yes (PDPL,
      // R106). Never blocks the Cat ID: attribution and consent are secondary
      // to the thing the person actually came for.
      if (f.waitlistConsent && user?.email) {
        void authedFetch("/waitlist", {
          method: "POST",
          body: JSON.stringify({
            email: user.email,
            catName: f.name.trim(),
            consent: true,
            locale: isAr ? "ar" : "en",
            ...(sourceCode ? { source: sourceCode } : {}),
          }),
        }).catch(() => { /* the ID is what matters; the list can wait */ });
      }
      return cat;
    },
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["cats"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setFirstIssue(Boolean(cat.firstCatIdIssued));
      // The census conversion moment — no PII, just the fact (lib/track.ts).
      track("cat_id_issued", { first: Boolean(cat.firstCatIdIssued) });
      setCeremonyCat(cat); // the reveal — then the welcome (first time) or the cats page
    },
    onError: (e) => toast({ title: isAr ? "تعذّر إصدار الهوية" : "Couldn't issue the Cat ID", description: friendlyMessage(e, isAr), variant: "error" }),
  });

  const catName = f.name.trim();

  /* ── The six required inputs (onboarding north star: under six) ──────────
   * cat name · sex · age · owner name · owner mobile · city.
   * `ageKnown` treats "0 years 0 months" as unanswered rather than as a
   * newborn: an untouched pair of fields is silence, not a claim.
   */
  const ageTotalMonths = Number(f.ageYears || 0) * 12 + Number(f.ageMonths || 0);
  const ageKnown = (f.ageYears !== "" || f.ageMonths !== "") && ageTotalMonths > 0;
  const catStepReady = Boolean(catName) && f.gender !== "" && ageKnown;
  const ownerStepReady =
    Boolean(f.ownerName.trim()) && f.ownerPhone.replace(/\D/g, "").length >= 9 && f.cityCode !== "";
  const allReady = catStepReady && ownerStepReady;

  /** What's still missing, named plainly so the button never just sits dead (R084/R113). */
  const missingLabel = React.useMemo(() => {
    const gaps: string[] = [];
    if (!catName) gaps.push(isAr ? "اسم القط" : "your cat's name");
    if (f.gender === "") gaps.push(isAr ? "الجنس" : "sex");
    if (!ageKnown) gaps.push(isAr ? "العمر" : "age");
    if (!f.ownerName.trim()) gaps.push(isAr ? "اسمك" : "your name");
    if (f.ownerPhone.replace(/\D/g, "").length < 9) gaps.push(isAr ? "رقم جوالك" : "your mobile");
    if (f.cityCode === "") gaps.push(isAr ? "المدينة" : "your city");
    return gaps.length ? gaps.join(isAr ? " · " : " · ") : null;
  }, [catName, f.gender, ageKnown, f.ownerName, f.ownerPhone, f.cityCode, isAr]);
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
                label={isAr ? "الجنس" : "Sex"}
                required
                value={f.gender}
                onChange={(v) => set({ gender: v })}
                options={[
                  // Empty first option = "unanswered". "Not sure" sits below as
                  // a real answer, because for a rescue it often IS the answer.
                  { value: "", label: isAr ? "اختر…" : "Choose…" },
                  { value: "MALE", label: isAr ? "ذكر" : "Male" },
                  { value: "FEMALE", label: isAr ? "أنثى" : "Female" },
                  { value: "UNKNOWN", label: isAr ? "ما أدري" : "Not sure" },
                ]}
              />
              <CatAge
                isAr={isAr}
                catName={catName}
                years={f.ageYears}
                months={f.ageMonths}
                onChange={(years, months) => set({ ageYears: years, ageMonths: months })}
              />
              <div>
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
                {/* PDPL people-in-photo attestation (R106): the upload itself is
                    the affirmative act — stated at the act, never pre-ticked. */}
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {isAr
                    ? "برفعك الصورة تؤكد أن أي شخص يظهر فيها موافق على نشرها."
                    : "By uploading, you confirm anyone visible in the photo agreed to share it."}
                </p>
              </div>

              {/* Recognition, not a form (R001): we already know who's behind
                  this cat — one quiet line, editable in place. */}
              {editContact ? (
                <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-3">
                  <Field label={isAr ? "اسمك الكامل" : "Your full name"} required value={f.ownerName} onChange={(v) => set({ ownerName: v })} />
                  <PhoneField
                    label={isAr ? "رقم جوالك" : "Your mobile number"}
                    required
                    isAr={isAr}
                    dialCode={f.ownerDialCode}
                    onDialCode={(v) => set({ ownerDialCode: v })}
                    value={f.ownerPhone}
                    onValue={(v) => set({ ownerPhone: v })}
                  />
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

              <CityPicker
                isAr={isAr}
                catName={catName}
                value={f.cityCode}
                onChange={(v) => set({ cityCode: v })}
              />

              <WaitlistConsent
                isAr={isAr}
                checked={f.waitlistConsent}
                onChange={(v) => set({ waitlistConsent: v })}
              />

              <ShareNotice
                isAr={isAr}
                catName={catName}
                on={f.sharePublicly}
                onChange={(v) => set({ sharePublicly: v })}
              />

              {missingLabel && (
                <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
                  {isAr ? `باقي: ${missingLabel}` : `Still needed: ${missingLabel}`}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/portal/cats")} disabled={create.isPending}>
                  <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" size="lg" disabled={!allReady || create.isPending}>
                  {create.isPending ? (
                    <><Loader2 className="size-4 animate-spin" /> {isAr ? "جارٍ إصدار الهوية…" : "Issuing the ID…"}</>
                  ) : (
                    <><CatIcon className="size-4" /> {isAr ? `أصدر هوية ${catName || "القط"}` : catName ? `Issue ${catName}'s Cat ID` : "Issue the Cat ID"}</>
                  )}
                </Button>
              </div>
            </form>
          ) : step === 0 ? (
            <form onSubmit={(e) => { e.preventDefault(); if (catStepReady) setStep(1); }} className="flex flex-col gap-4">
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
                label={isAr ? "الجنس" : "Sex"}
                required
                value={f.gender}
                onChange={(v) => set({ gender: v })}
                options={[
                  // Empty first option = "unanswered". "Not sure" sits below as
                  // a real answer, because for a rescue it often IS the answer.
                  { value: "", label: isAr ? "اختر…" : "Choose…" },
                  { value: "MALE", label: isAr ? "ذكر" : "Male" },
                  { value: "FEMALE", label: isAr ? "أنثى" : "Female" },
                  { value: "UNKNOWN", label: isAr ? "ما أدري" : "Not sure" },
                ]}
              />
              <CatAge
                isAr={isAr}
                catName={catName}
                years={f.ageYears}
                months={f.ageMonths}
                onChange={(years, months) => set({ ageYears: years, ageMonths: months })}
              />
              <div>
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
                {/* PDPL people-in-photo attestation (R106): the upload itself is
                    the affirmative act — stated at the act, never pre-ticked. */}
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {isAr
                    ? "برفعك الصورة تؤكد أن أي شخص يظهر فيها موافق على نشرها."
                    : "By uploading, you confirm anyone visible in the photo agreed to share it."}
                </p>
              </div>
              {missingLabel && (
                <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
                  {isAr ? `باقي: ${missingLabel}` : `Still needed: ${missingLabel}`}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/portal/cats")}>
                  <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" size="lg" disabled={!catStepReady}>
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
              <PhoneField
                    label={isAr ? "رقم جوالك" : "Your mobile number"}
                    required
                    isAr={isAr}
                    dialCode={f.ownerDialCode}
                    onDialCode={(v) => set({ ownerDialCode: v })}
                    value={f.ownerPhone}
                    onValue={(v) => set({ ownerPhone: v })}
                  />
              {/* Trust precedes the ask (R004): say plainly why we want a number. */}
              <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                {isAr
                  ? `لو ضاع ${catName || "قطك"} يوم من الأيام، هذا الرقم اللي يوصله له اللي يلقاه.`
                  : `If ${catName || "your cat"} is ever lost, this is the number that brings them home.`}
              </p>
              <CityPicker
                isAr={isAr}
                catName={catName}
                value={f.cityCode}
                onChange={(v) => set({ cityCode: v })}
              />

              <WaitlistConsent
                isAr={isAr}
                checked={f.waitlistConsent}
                onChange={(v) => set({ waitlistConsent: v })}
              />
              <ShareNotice
                isAr={isAr}
                catName={catName}
                on={f.sharePublicly}
                onChange={(v) => set({ sharePublicly: v })}
              />
              {missingLabel && (
                <p className="text-xs leading-relaxed text-muted-foreground" aria-live="polite">
                  {isAr ? `باقي: ${missingLabel}` : `Still needed: ${missingLabel}`}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(0)} disabled={create.isPending}>
                  <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "رجوع" : "Back"}
                </Button>
                <Button type="submit" size="lg" disabled={!allReady || create.isPending}>
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
          cat={{ name: ceremonyCat.name, catIdNumber: ceremonyCat.catIdNumber, catNumber: ceremonyCat.catNumber, foundingClass: isAr ? ceremonyCat.foundingClass?.ar : ceremonyCat.foundingClass?.en, idIssuedAt: ceremonyCat.idIssuedAt, photoUrl: ceremonyCat.photoUrl, qrToken: ceremonyCat.qrToken }}
          isAr={isAr}
          // The full rite is for the household's first ID; every next family
          // member gets the warm, familiar mini welcome (R031/R009).
          variant={firstIssue ? "full" : "mini"}
          ownerFirstName={ownerFirstName || null}
          // The cat was (usually) published at creation — the ceremony
          // celebrates the fact and offers customize/keep-private (opt-out
          // default, decision 2026-08-14).
          initiallyPublic={Boolean(ceremonyCat.isPublic)}
          consentDone={Boolean(ceremonyCat.isPublic && ceremonyCat.photoUrl)}
          onShareChoice={
            firstIssue
              ? async (choice: ShareChoice) => {
                  const body: Record<string, unknown> = { isPublic: choice.public };
                  if (choice.public) {
                    // PDPL attestation (R106): sent only when the ceremony
                    // actually gathered it (not when it was already stamped at
                    // creation); the server mints shareConsentAt itself.
                    if (choice.consent) body.consent = true;
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
