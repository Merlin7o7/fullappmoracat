"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Loader2, Mail, X } from "lucide-react";
import { Button, IdBand, Seal, useToast } from "@moraqat/ui";
import { countLabel } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { Field } from "@/components/field";
import { PhoneField, nationalNumberOk } from "@/components/phone-field";
import { useCaptureSource } from "@/lib/source";
import { readFirstTouch } from "@/lib/first-touch";
import { track } from "@/lib/track";
import { CodeEntry, EMAIL_RE, codeErrorMessage, useResendCooldown } from "@/components/signup/email-code";
import { CommunityDisclosure, PhotoAttestation, WaitlistConsentLine } from "@/components/signup/consents";
import {
  HANDOFF_KEY,
  PENDING_NAME_KEY,
  PHOTO_PERSIST_MAX,
  REGISTER_STARTED_KEY,
  SIGNUP_DRAFT_KEY,
  clearSignupDraft,
  readJson,
  removeKey,
  sameCatName,
  writeJson,
  type SignupDraft,
  type SignupHandoff,
} from "@/components/signup/draft";

type Step = "cat" | "owner" | "email" | "code";
const STEPS: Step[] = ["cat", "owner", "email", "code"];
const parseStep = (v: string | null): Step => (STEPS as string[]).includes(v ?? "") ? (v as Step) : "cat";

/**
 * Sign-up, 2026-10-04 (R016 — under six inputs, under two minutes):
 *
 *   1 · the cat   — name (carried from the homepage), and an optional photo
 *                   («أضيفها بعدين»: a faceless cat simply isn't published)
 *   2 · the owner — name + mobile (the number that brings a lost cat home),
 *                   plus the two decisions that apply right now: the care-plan
 *                   waitlist (unticked) and community visibility (on, with
 *                   its off switch beside it — 2026-08-14 guardrail #1)
 *   3 · an email + the 6-digit code it gets (no password)
 *
 * Each step is a ?step= URL, so the phone's Back button walks the steps; the
 * whole form (never the code) lives in sessionStorage, so a refresh loses
 * nothing (R117). An existing member who signs in here is never handed a
 * duplicate cat: same name → their cat's profile; other cats → we ask.
 */
export function StartFlow({ isAr }: { isAr: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const step = parseStep(search.get("step"));
  const { user, ready, authedFetch, emailCodeStart, emailCodeContinue } = useAuth();
  const { toast } = useToast();
  const t = (ar: string, en: string) => (isAr ? ar : en);

  const [hydrated, setHydrated] = React.useState(false);
  const [name, setName] = React.useState("");
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [photoAttested, setPhotoAttested] = React.useState(false);
  const [photoNote, setPhotoNote] = React.useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [ownerName, setOwnerName] = React.useState("");
  const [dialCode, setDialCode] = React.useState("+966");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [waitlistConsent, setWaitlistConsent] = React.useState(false);
  const [sharePublicly, setSharePublicly] = React.useState(true);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<React.ReactNode>(null);
  const [devCode, setDevCode] = React.useState<string | null>(null);
  // An existing member signed in here and already has other cats: ask, don't assume.
  const [existing, setExisting] = React.useState<{ count: number } | null>(null);
  const cooldown = useResendCooldown();
  const prefilledRef = React.useRef(false);

  // Stand / campaign source (?src=) and an inviting member (?ref=) are kept.
  useCaptureSource();
  const refCode = React.useMemo(() => {
    const r = search.get("ref");
    return r && /^[A-Za-z0-9-]{3,40}$/.test(r) ? r : null;
  }, [search]);

  // ── Restore the draft (and the name typed on the homepage) once ─────────
  React.useEffect(() => {
    const d = readJson<SignupDraft>(SIGNUP_DRAFT_KEY) ?? {};
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_NAME_KEY);
    } catch {
      /* ignore */
    }
    prefilledRef.current = Boolean(pending);
    setName(d.name || pending || "");
    if (d.ownerName) setOwnerName(d.ownerName);
    if (d.dialCode) setDialCode(d.dialCode);
    if (d.phone) setPhone(d.phone);
    if (d.email) setEmail(d.email);
    if (typeof d.waitlistConsent === "boolean") setWaitlistConsent(d.waitlistConsent);
    if (typeof d.sharePublicly === "boolean") setSharePublicly(d.sharePublicly);
    if (d.photo && d.photo.startsWith("data:image/")) {
      setPhoto(d.photo);
      setPhotoAttested(Boolean(d.photoAttested));
    } else if (d.photoDropped) {
      setPhotoNote(
        isAr
          ? "رجّعنا لك كل شي إلا الصورة — كانت أكبر من اللي نقدر نحفظه مؤقتاً. اخترها مرة ثانية، أو أضفها بعدين."
          : "Everything came back except the photo — it was too large to keep. Pick it again, or add it later."
      );
    }
    setHydrated(true);
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keep the draft current (never the code) ──────────────────────────────
  React.useEffect(() => {
    if (!hydrated) return;
    const keepPhoto = Boolean(photo && photo.length <= PHOTO_PERSIST_MAX);
    const draft: SignupDraft = {
      name,
      ownerName,
      dialCode,
      phone,
      email,
      waitlistConsent,
      sharePublicly,
      photo: keepPhoto ? photo : null,
      photoAttested: keepPhoto ? photoAttested : false,
      photoDropped: Boolean(photo) && !keepPhoto,
    };
    if (!writeJson(SIGNUP_DRAFT_KEY, draft)) {
      // Storage full: keep everything but the photo.
      writeJson(SIGNUP_DRAFT_KEY, { ...draft, photo: null, photoAttested: false, photoDropped: Boolean(photo) });
    }
  }, [hydrated, name, ownerName, dialCode, phone, email, waitlistConsent, sharePublicly, photo, photoAttested]);

  const catName = name.trim();
  const catReady = catName.length >= 1;
  const ownerNameOk = ownerName.trim().length >= 1;
  const phoneOk = nationalNumberOk(dialCode, phone);
  const ownerReady = ownerNameOk && phoneOk;
  const emailOk = EMAIL_RE.test(email.trim());

  // ── Steps as URLs ────────────────────────────────────────────────────────
  const pushedRef = React.useRef(false);
  const goStep = React.useCallback(
    (next: Step, replace = false) => {
      const q = new URLSearchParams(search.toString());
      if (next === "cat") q.delete("step");
      else q.set("step", next);
      const qs = q.toString();
      const url = `${pathname}${qs ? `?${qs}` : ""}`;
      setError(null);
      if (replace) router.replace(url, { scroll: false });
      else {
        pushedRef.current = true;
        router.push(url, { scroll: false });
      }
    },
    [pathname, router, search]
  );
  /** In-page Back mirrors the browser's; after a refresh there's no history to pop. */
  const goBack = (to: Step) => (pushedRef.current ? router.back() : goStep(to, true));

  // A deep link or a refresh can land on a step whose earlier answers are missing.
  React.useEffect(() => {
    if (!hydrated || existing) return;
    if (step !== "cat" && !catReady) goStep("cat", true);
    else if ((step === "email" || step === "code") && !ownerReady) goStep("owner", true);
    else if (step === "code" && !emailOk) goStep("email", true);
  }, [hydrated, existing, step, catReady, ownerReady, emailOk, goStep]);

  // ── register_started: once per browser session, on the first real touch ──
  const startedRef = React.useRef(false);
  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    try {
      if (sessionStorage.getItem(REGISTER_STARTED_KEY)) return;
      sessionStorage.setItem(REGISTER_STARTED_KEY, "1");
    } catch {
      /* without storage the ref still prevents a double fire on this page */
    }
    track("register_started", { prefilled: prefilledRef.current, step });
  };

  // ── Hand-off to the issue step ───────────────────────────────────────────
  function handOff() {
    const payload: SignupHandoff = {
      name: catName,
      photo,
      photoAttested: Boolean(photo && photoAttested),
      ownerName: ownerName.trim(),
      dialCode,
      phone: phone.trim(),
      waitlistConsent,
      sharePublicly,
    };
    if (!writeJson(HANDOFF_KEY, payload)) {
      // No room for the photo: the cat is still issued; the photo is added later.
      writeJson(HANDOFF_KEY, { ...payload, photo: null, photoAttested: false });
      if (photo) {
        toast({
          title: t("الصورة ما انتقلت معنا", "The photo didn't come along"),
          description: t(`نصدر هوية ${catName} الحين، وتضيف صورته من ملفه.`, `We'll issue ${catName}'s ID now — add the photo from their file.`),
          variant: "error",
        });
      }
    }
    removeKey(PENDING_NAME_KEY);
    router.push("/portal/cats/new?from=start");
  }

  /** Signed in to an account that already exists: never mint a twin. */
  async function continueSignedIn() {
    setBusy(true);
    try {
      const cats = await authedFetch<{ id: string; name: string; status: string }[]>("/cats");
      const active = cats.filter((c) => c.status === "ACTIVE");
      const same = active.find((c) => sameCatName(c.name, catName));
      if (same) {
        clearSignupDraft();
        toast({
          title: t(`${same.name} عندك من قبل`, `${same.name} is already here`),
          description: t("فتحنا لك ملفه — ما سوينا له هوية ثانية.", "We opened their file — no second ID was made."),
          variant: "success",
        });
        router.push(`/portal/cats/${same.id}`);
        return;
      }
      if (active.length > 0) {
        setExisting({ count: active.length });
        return;
      }
      handOff();
    } catch {
      // Couldn't list the cats: the server's same-name guard still prevents a twin.
      handOff();
    } finally {
      setBusy(false);
    }
  }

  // ── Email + code ─────────────────────────────────────────────────────────
  async function sendCode(advance: boolean) {
    setBusy(true);
    setError(null);
    try {
      const r = await emailCodeStart(email, isAr ? "ar" : "en");
      setDevCode(r.devCode ?? null);
      setCode("");
      cooldown.start();
      if (advance) goStep("code");
    } catch (e) {
      const ce = codeErrorMessage(e, isAr);
      // Only the per-address cooldown means a code is already on its way (a
      // bare 429 from the IP throttle means nothing was sent).
      if ((e as { code?: string }).code === "OTP_RATE_LIMITED" && advance) {
        // A code went out moments ago and still works — go and use it.
        goStep("code");
        setError(t("أرسلنا لك رمزاً قبل شوي — استخدمه، أو اطلب جديداً بعد دقيقة.", "We sent you a code a moment ago — use that one, or ask for a new one in a minute."));
      } else {
        setError(ce.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await emailCodeContinue({
        email,
        code: value,
        intent: "signup",
        acceptTerms: true,
        fullName: ownerName.trim() || undefined,
        locale: isAr ? "ar" : "en",
        firstTouch: readFirstTouch(),
        ref: refCode ?? undefined,
      });
      setBusy(false);
      if (r.created) handOff();
      else await continueSignedIn();
    } catch (e) {
      const ce = codeErrorMessage(e, isAr);
      setError(
        ce.code === "TOTP_REQUIRED" ? (
          <p>
            {t("حسابك محمي بخطوتين — ", "Your account uses two-step sign-in — ")}
            <Link href="/login" className="font-medium text-primary underline underline-offset-4">
              {t("ادخل بكلمة المرور", "sign in with your password")}
            </Link>
          </p>
        ) : (
          ce.message
        )
      );
      if (!ce.network) setCode("");
      setBusy(false);
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoNote(null);
    try {
      setPhoto(await compressPhoto(file));
      // Chosen with the attestation line in view — the act is the attestation.
      setPhotoAttested(true);
    } catch {
      setPhotoNote(t("ما قدرنا نقرأ الصورة — جرّب صورة ثانية، أو أضفها بعدين.", "We couldn't read that photo — try another, or add it later."));
    } finally {
      setPhotoBusy(false);
    }
  }

  const progress = step === "cat" ? 1 : step === "owner" ? 2 : 3;
  const missing = (gaps: string[]) =>
    gaps.length ? (
      <p className="text-center text-xs text-muted-foreground" aria-live="polite">
        {t("باقي: ", "Still needed: ")}
        {gaps.join(" · ")}
      </p>
    ) : null;
  const NextIcon = isAr ? ArrowLeft : ArrowRight;
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  if (!hydrated) return <div className="mx-auto min-h-[420px] w-full max-w-md" aria-hidden />;

  return (
    <div className="mx-auto w-full max-w-md space-y-6" onPointerDownCapture={markStarted} onKeyDownCapture={markStarted}>
      {/* The artifact being made, from the first second: a blank ID band. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <IdBand kind={t("هوية مرقط", "Moracat ID")} serial="MRC-····-····" seal={<Seal label={t("تُصدر بعد قليل", "Issued in a moment")} />} />
        <div className="flex items-center gap-4 px-5 py-6">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
          )}
          <div className="min-w-0">
            <p className="font-display text-4xl leading-tight">{catName || t("اسم قطك", "Your cat's name")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("ثلاث خطوات وتصير الهوية جاهزة", "Three steps and the ID is ready")}</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t(`الخطوة ${progress} من 3`, `Step ${progress} of 3`)}
      </p>

      {step === "cat" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (catReady) goStep("owner");
          }}
          className="space-y-5"
        >
          <Field label={t("اسم قطك", "Your cat's name")} required value={name} onChange={(v) => setName(v.slice(0, 60))} autoFocus autoComplete="off" />

          <div>
            <p className="mb-2 text-sm font-medium">
              {catName ? t(`صورة ${catName}`, `A photo of ${catName}`) : t("صورة قطك", "A photo of your cat")}{" "}
              <span className="font-normal text-muted-foreground">{t("(اختياري)", "(optional)")}</span>
            </p>
            <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
              <label className="flex min-h-16 cursor-pointer items-center gap-4">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="size-16 rounded-xl object-cover" />
                ) : (
                  <span className="grid size-16 place-items-center rounded-xl bg-muted">
                    {photoBusy ? <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden /> : <Camera className="size-6 text-muted-foreground" aria-hidden />}
                  </span>
                )}
                <span className="text-sm">
                  <span className="block font-medium">{photo ? t("غيّر الصورة", "Change the photo") : t("أضف صورة", "Add a photo")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("تطلع على هويته وفي مجتمع مرقط.", "It goes on their ID and in the Moracat community.")}
                  </span>
                </span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
              </label>
              <PhotoAttestation isAr={isAr} className="mt-3" />
              {photo ? (
                <button
                  type="button"
                  onClick={() => { setPhoto(null); setPhotoAttested(false); }}
                  className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  <X className="size-3.5" aria-hidden /> {t("شيل الصورة", "Remove the photo")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!catReady}
                  onClick={() => goStep("owner")}
                  className="mt-1 min-h-11 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:text-muted-foreground"
                >
                  {t("أضيفها بعدين", "I'll add it later")}
                </button>
              )}
            </div>
            {photoNote && <p role="status" className="mt-2 text-xs text-destructive">{photoNote}</p>}
          </div>

          <Button type="submit" size="lg" className="w-full" loading={photoBusy} disabled={!catReady || photoBusy}>
            {t("التالي", "Next")}
            <NextIcon className="size-4" aria-hidden />
          </Button>
          {missing(catReady ? [] : [t("اسم قطك", "your cat's name")])}
        </form>
      )}

      {step === "owner" && !existing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ownerReady || busy) return;
            if (ready && user) void continueSignedIn();
            else goStep("email");
          }}
          className="space-y-5"
        >
          <Field label={t("اسمك", "Your name")} required value={ownerName} onChange={setOwnerName} autoFocus autoComplete="name" />
          <PhoneField
            label={t("رقم جوالك", "Your mobile")}
            dialCode={dialCode}
            onDialCode={setDialCode}
            value={phone}
            onValue={setPhone}
            required
            isAr={isAr}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(
              `لو ضاع ${catName || "قطك"}، اللي يلقاه يوصلك برسالة من صفحة رمز الطوق — رقمك ما يظهر فيها.`,
              `If ${catName || "your cat"} is ever lost, whoever finds them messages you from the collar QR page — your number isn't shown there.`
            )}
          </p>

          <WaitlistConsentLine isAr={isAr} checked={waitlistConsent} onChange={setWaitlistConsent} />
          <CommunityDisclosure isAr={isAr} catName={catName} isPublic={sharePublicly} onChange={setSharePublicly} />

          <div className="flex items-center gap-3">
            <Button type="button" variant="tertiary" size="lg" onClick={() => goBack("cat")}>
              <BackIcon className="size-4" aria-hidden />
              {t("رجوع", "Back")}
            </Button>
            <Button type="submit" size="lg" className="flex-1" loading={busy} disabled={!ownerReady || !ready || busy}>
              {t("التالي", "Next")}
              <NextIcon className="size-4" aria-hidden />
            </Button>
          </div>
          {missing([
            ...(ownerNameOk ? [] : [t("اسمك", "your name")]),
            ...(phoneOk ? [] : [t("رقم جوالك", "your mobile")]),
          ])}
        </form>
      )}

      {step === "email" && (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (emailOk) void sendCode(true);
            }}
            className="space-y-4"
          >
            <Field
              label={t("بريدك الإلكتروني", "Your email")}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={setEmail}
              hint={t("نرسل لك رمزاً من 6 أرقام — بدون كلمة مرور.", "We'll send a 6-digit code — no password.")}
            />
            {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
            <div className="flex items-center gap-3">
              <Button type="button" variant="tertiary" size="lg" onClick={() => goBack("owner")}>
                <BackIcon className="size-4" aria-hidden />
                {t("رجوع", "Back")}
              </Button>
              <Button type="submit" size="lg" className="flex-1" loading={busy} disabled={!emailOk || busy}>
                <Mail className="size-4" aria-hidden /> {t("أرسل الرمز", "Send the code")}
              </Button>
            </div>
            {missing(emailOk ? [] : [t("بريدك", "your email")])}
          </form>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("بالمتابعة أنت توافق على ", "By continuing you agree to the ")}
            <Link href="/legal/terms" className="underline underline-offset-4">{t("الشروط", "Terms")}</Link>
            {t(" و", " and ")}
            <Link href="/legal/privacy" className="underline underline-offset-4">{t("سياسة الخصوصية", "Privacy Policy")}</Link>.
          </p>
        </div>
      )}

      {step === "code" && !existing && (
        <CodeEntry
          email={email}
          isAr={isAr}
          code={code}
          onCode={setCode}
          onComplete={(v) => void verify(v)}
          busy={busy}
          error={error}
          devCode={devCode}
          resendLeft={cooldown.left}
          onResend={() => void sendCode(false)}
          onChangeEmail={() => { setCode(""); goBack("email"); }}
        >
          <Button size="lg" className="w-full" loading={busy} disabled={code.length !== 6 || busy} onClick={() => void verify(code)}>
            {t("تأكيد وإصدار الهوية", "Confirm and issue the ID")}
          </Button>
        </CodeEntry>
      )}

      {existing && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5" role="status">
          <p className="font-display text-xl leading-snug">
            {t(
              `عندك حساب فيه ${countLabel(existing.count, "ar", { ar: { one: "قط واحد", two: "قطّين", few: "قطط", many: "قطاً" }, en: { one: "cat", other: "cats" } })} — نضيف ${catName} كقط جديد؟`,
              `You already have an account with ${countLabel(existing.count, "en", { ar: { one: "", two: "", few: "", many: "" }, en: { one: "cat", other: "cats" } })} — add ${catName} as a new cat?`
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="flex-1" onClick={handOff}>
              {t(`أضف ${catName}`, `Add ${catName}`)}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="flex-1"
              onClick={() => {
                clearSignupDraft();
                router.push("/portal/cats");
              }}
            >
              {t("روح لقططي", "Go to my cats")}
            </Button>
          </div>
        </div>
      )}

      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          {t("عندك حساب؟ ", "Already a member? ")}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">{t("ادخل لملف قطك", "Sign in")}</Link>
        </p>
      )}
    </div>
  );
}

/**
 * Shrink a photo to ≤ 1200 px on its long side as a JPEG data URL — small
 * enough to carry through sessionStorage to the issue step (where it is
 * uploaded), large enough for the card and the community page.
 */
async function compressPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
