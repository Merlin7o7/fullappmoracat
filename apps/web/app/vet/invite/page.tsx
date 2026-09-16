"use client";

/**
 * Accepting a clinic invitation (MRC-VET-001 §02, MRC-VET-002 phase 4).
 *
 * The invite is where a colleague becomes accountable: from here on, every
 * record they read and every benefit they apply carries their name. So the one
 * thing this page insists on is the confidentiality undertaking — one screen,
 * plain language, versioned, stored. Everything else gets out of the way:
 *
 *   • It says what they're joining BEFORE asking for anything (R004): the
 *     clinic, the role, who the link is for, and when it expires.
 *   • No account yet → the account is created right here, with the email the
 *     invitation was sent to (the inbox is the proof), and accepted in one step.
 *   • An account exists → sign in inline with the invited email; no detour.
 *   • Signed in as someone else → say so and offer the way out; never a 403.
 *   • After accepting, the next step depends on the clinic's status — a clinic
 *     still under review gets a calm "we'll email you", never a dead end (R084).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Languages,
  Loader2,
  LogOut,
  MailQuestion,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Button, Card, Input, cn, useToast } from "@moraqat/ui";
import { VET_STAFF_CONFIDENTIALITY } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ApiError } from "@/lib/http";
import { formatDate } from "@/lib/datetime";
import { rememberVetOrg } from "@/lib/vet-api";
import { InviteSignIn } from "@/components/vet/invite-sign-in";
import {
  claimStaffInvite,
  previewStaffInvite,
  registrationError,
  useRegistrationApi,
  type RegFriendlyError,
  type StaffInviteAccepted,
  type StaffInvitePreview,
} from "@/lib/vet-registration";

type Friendly = { title: string; message: string; code?: string } | null;

/** Mirrors apps/api/src/auth/password-policy.ts: ≥ 8 chars, a Latin letter and a digit. */
const PASSWORD_OK = (p: string) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

export default function VetInvitePage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const { toast } = useToast();
  const { user, ready, logout, adoptSession } = useAuth();
  const regApi = useRegistrationApi();

  const [token, setToken] = React.useState<string | null | undefined>(undefined);
  const [preview, setPreview] = React.useState<StaffInvitePreview | null>(null);
  const [previewError, setPreviewError] = React.useState<RegFriendlyError | null>(null);

  const [docLang, setDocLang] = React.useState<"ar" | "en">(isAr ? "ar" : "en");
  const [agreed, setAgreed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<Friendly>(null);
  const [accepted, setAccepted] = React.useState<StaffInviteAccepted | null>(null);

  // Create-account fields
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  // The undertaking follows the interface language until someone chooses.
  const docLangTouched = React.useRef(false);
  React.useEffect(() => {
    if (!docLangTouched.current) setDocLang(isAr ? "ar" : "en");
  }, [isAr]);

  // Read from the URL at mount rather than useSearchParams — no Suspense
  // boundary needed, and the token never leaves this client except to the API.
  React.useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    previewStaffInvite(token)
      .then((p) => {
        if (cancelled) return;
        setPreview(p);
        // Prefill from the name the owner typed — nobody types it twice (R013).
        if (p.fullName) {
          const [first, ...rest] = p.fullName.trim().split(/\s+/);
          setFirstName((v) => v || first || "");
          setLastName((v) => v || rest.join(" "));
        }
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(registrationError(err, isAr));
      });
    return () => {
      cancelled = true;
    };
    // isAr only shapes the copy of a failure — don't refetch on a language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function onAccepted(result: StaffInviteAccepted) {
    setAccepted(result);
    rememberVetOrg(result.orgId);
    toast({
      title: isAr
        ? `أهلاً بك في ${result.org.nameAr || result.org.nameEn}`
        : `Welcome to ${result.org.nameEn || result.org.nameAr}`,
      description: isAr ? result.roleLabel.ar : result.roleLabel.en,
      variant: "success",
    });
  }

  function requireAgreement(): boolean {
    if (agreed) return true;
    setError(
      isAr
        ? { title: "وافق على تعهّد السرية", message: "ضع علامة على مربع الموافقة أعلاه للمتابعة." }
        : { title: "Accept the confidentiality undertaking", message: "Tick the agreement box above to continue." },
    );
    return false;
  }

  /** Signed in with the invited email → accept. */
  async function acceptSignedIn() {
    if (!token || !preview || !requireAgreement()) return;
    setBusy(true);
    setError(null);
    try {
      onAccepted(await regApi.acceptStaffInvite(token, preview.confidentialityVersion));
    } catch (err) {
      setError(registrationError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  /** Account exists: a session was just established (password or Google) → accept. */
  async function acceptAfterSignIn() {
    if (!token || !preview) return;
    setBusy(true);
    setError(null);
    try {
      onAccepted(await regApi.acceptStaffInvite(token, preview.confidentialityVersion));
    } catch (err) {
      setError(registrationError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  /** No account → create it and accept in one step. */
  async function createAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !preview) return;
    setError(null);
    if (!firstName.trim()) {
      setError(isAr ? { title: "اكتب اسمك", message: "الاسم الأول يظهر على كل ما تكتبه في السجل." } : { title: "Add your name", message: "Your first name appears on everything you write in a record." });
      return;
    }
    if (!PASSWORD_OK(password)) {
      setError(registrationError(new ApiError("weak", "http", 400, "WEAK_PASSWORD"), isAr));
      return;
    }
    if (password !== confirmPassword) {
      setError(
        isAr
          ? { title: "كلمتا المرور غير متطابقتين", message: "اكتب كلمة المرور نفسها في الخانتين." }
          : { title: "The passwords don't match", message: "Type the same password in both boxes." },
      );
      return;
    }
    if (!requireAgreement()) return;
    setBusy(true);
    try {
      const res = await claimStaffInvite({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        password,
        acceptConfidentiality: true,
        confidentialityVersion: preview.confidentialityVersion,
      });
      adoptSession(res);
      onAccepted(res.accepted);
    } catch (err) {
      setError(registrationError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  /* ── No token in the link ───────────────────────────────────────────────── */
  if (token === null) {
    return (
      <Centered>
        <IconBubble tone="info">
          <MailQuestion className="size-5" />
        </IconBubble>
        <h1 className="font-display text-lg font-semibold">{isAr ? "هذا الرابط ناقص" : "This link is incomplete"}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "افتح الرابط كاملاً من رسالة الدعوة — بعض برامج البريد تقصّه. إذا انتهت مدته، مدير العيادة يرسل واحداً جديداً في ثوانٍ."
            : "Open the full link from your invitation email — some mail apps clip it. If it has expired, a clinic manager can send a fresh one in seconds."}
        </p>
        <Link href="/vet/login">
          <Button size="sm" variant="outline">
            {isAr ? "دخول فريق العيادة" : "Clinic team sign-in"}
          </Button>
        </Link>
      </Centered>
    );
  }

  /* ── Accepted ───────────────────────────────────────────────────────────── */
  if (accepted) return <AcceptedScreen accepted={accepted} isAr={isAr} />;

  /* ── The invitation can't be used ───────────────────────────────────────── */
  if (previewError) {
    const used = previewError.code === "VET_INVITE_USED";
    return (
      <Centered>
        <IconBubble tone="info">
          <MailQuestion className="size-5" />
        </IconBubble>
        <h1 className="font-display text-lg font-semibold">{previewError.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {previewError.message}
          {!used &&
            (isAr
              ? " مدير عيادتك يستطيع إرسال دعوة جديدة من إعدادات العيادة."
              : " Your clinic manager can send a new one from Clinic settings.")}
        </p>
        <Link href="/vet/login">
          <Button size="sm" variant={used ? "primary" : "outline"}>
            {isAr ? "دخول فريق العيادة" : "Clinic team sign-in"}
          </Button>
        </Link>
      </Centered>
    );
  }

  if (token === undefined || !preview || !ready) {
    return (
      <Centered>
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {isAr ? "نفتح دعوتك…" : "Opening your invitation…"}
        </p>
      </Centered>
    );
  }

  const orgName = isAr ? preview.orgName.ar || preview.orgName.en : preview.orgName.en || preview.orgName.ar;
  const signedInAsOther = !!user && user.email.toLowerCase() !== preview.email.toLowerCase();
  const doc = VET_STAFF_CONFIDENTIALITY;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-8 sm:py-10">
      {/* ── What you're joining — before anything is asked ── */}
      <Card className="flex items-start gap-4 p-5">
        {preview.orgLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.orgLogoUrl}
            alt=""
            className="size-14 shrink-0 rounded-2xl border border-border bg-background object-contain"
          />
        ) : (
          <IconBubble tone="primary" size="lg">
            <Stethoscope className="size-6" />
          </IconBubble>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{isAr ? "دعوة للانضمام إلى فريق" : "You're invited to join the team at"}</p>
          <h1 className="font-display text-xl font-semibold leading-tight">{orgName}</h1>
          <p className="mt-1 text-sm">
            {isAr ? "بدور " : "as "}
            <span className="font-medium">{isAr ? preview.roleLabel.ar : preview.roleLabel.en}</span>
          </p>
          <dl className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-1.5">
              <dt>{isAr ? "الدعوة لـ" : "For"}</dt>
              <dd className="min-w-0">
                {preview.fullName && <span className="text-foreground">{preview.fullName} · </span>}
                <span dir="ltr" className="break-all">
                  {preview.email}
                </span>
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5">
              <CalendarClock className="size-3.5" aria-hidden />
              <dt className="sr-only">{isAr ? "الصلاحية" : "Expiry"}</dt>
              <dd>
                {isAr
                  ? `صالحة حتى ${formatDate(preview.expiresAt, loc)}`
                  : `Valid until ${formatDate(preview.expiresAt, loc)}`}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* ── The undertaking — always shown, always required ── */}
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold leading-tight" lang={docLang}>
              {docLang === "ar" ? doc.titleAr : doc.titleEn}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isAr
                ? "صفحة واحدة بلغة واضحة — الأمانة التي يلتزم بها كل من يفتح سجلاً طبياً في مرقط."
                : "One page, plain language — the trust everyone who opens a medical record on Moracat keeps."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              docLangTouched.current = true;
              setDocLang((l) => (l === "ar" ? "en" : "ar"));
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Languages className="size-3.5" aria-hidden />
            {docLang === "ar" ? "Read in English" : "اقرأه بالعربية"}
          </button>
        </div>

        <div dir={docLang === "ar" ? "rtl" : "ltr"} lang={docLang} className="flex flex-col gap-3">
          {doc.sections.map((section) => (
            <div key={section.id}>
              <p className="mb-2 text-sm font-medium">{docLang === "ar" ? section.titleAr : section.titleEn}</p>
              <ul className="flex flex-col gap-2.5 text-sm leading-relaxed">
                {(docLang === "ar" ? section.bodyAr : section.bodyEn).map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <label
          className={cn(
            "mt-1 flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
            agreed ? "border-primary/40 bg-primary/[0.06]" : "border-border hover:bg-muted",
          )}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              if (e.target.checked) setError(null);
            }}
            className="size-5 shrink-0 accent-[hsl(var(--primary))]"
          />
          <span>
            {isAr
              ? "قرأت تعهّد السرية وألتزم به، وأفهم أن كل إجراء يُنسب لي."
              : "I've read the confidentiality undertaking and will keep to it, and I understand every action is attributed to me."}
          </span>
        </label>
        <p className="text-[0.6875rem] text-muted-foreground">
          {isAr ? `نسخة ${doc.version}` : `Version ${doc.version}`}
        </p>
      </Card>

      {/* ── The one next step, shaped by who's here ── */}
      <Card className="flex flex-col gap-4 p-5">
        {signedInAsOther ? (
          <>
            <div className="flex items-start gap-3">
              <IconBubble tone="info">
                <LogOut className="size-5" />
              </IconBubble>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">{isAr ? "أنت مسجّل بحساب آخر" : "You're signed in as someone else"}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {isAr ? "أنت داخل بحساب " : "You're signed in as "}
                  <span dir="ltr" className="break-all font-medium text-foreground">
                    {user?.email}
                  </span>
                  {isAr ? "، والدعوة أُرسلت إلى " : ", but this invitation went to "}
                  <span dir="ltr" className="break-all font-medium text-foreground">
                    {preview.email}
                  </span>
                  {isAr
                    ? ". سجّل الخروج لتتابع بالبريد المدعو — لكل زميل حساب باسمه."
                    : ". Sign out to continue with the invited email — every colleague has their own account."}
                </p>
              </div>
            </div>
            <Button size="lg" variant="outline" className="w-full" onClick={() => void logout()}>
              <LogOut className="size-4" aria-hidden />
              {isAr ? "سجّل الخروج وتابع" : "Sign out and continue"}
            </Button>
          </>
        ) : user ? (
          <>
            <p className="text-sm text-muted-foreground">
              {isAr ? "أنت داخل بالبريد المدعو " : "You're signed in with the invited email "}
              <span dir="ltr" className="break-all font-medium text-foreground">
                {user.email}
              </span>
              .
            </p>
            <ErrorBlock error={error} />
            <Button size="lg" className="w-full" loading={busy} onClick={() => void acceptSignedIn()}>
              {isAr ? "اقبل الدعوة وانضم للفريق" : "Accept and join the team"}
            </Button>
          </>
        ) : preview.accountExists ? (
          // Only the doors this account has: Google for a Google-created account
          // (no password exists), the password form when one does, and an
          // emailed set-password link as the fallback.
          <>
            <InviteSignIn
              isAr={isAr}
              email={preview.email}
              methods={preview.signIn}
              beforeSignIn={requireAgreement}
              onSignedIn={acceptAfterSignIn}
              submitLabel={{ ar: "ادخل واقبل الدعوة", en: "Sign in and accept" }}
            />
            <ErrorBlock error={error} />
          </>
        ) : (
          <form onSubmit={createAndAccept} className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold">{isAr ? "أنشئ حسابك" : "Create your account"}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {isAr
                  ? "لكل زميل حساب باسمه — لأن كل ما يُكتب في السجل الطبي يُنسب لشخص."
                  : "Every colleague has their own account, because everything written into a medical record is attributed to a person."}
              </p>
            </div>
            <ReadOnlyEmail email={preview.email} isAr={isAr} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={isAr ? "الاسم الأول" : "First name"}
                value={firstName}
                onChange={setFirstName}
                autoComplete="given-name"
                required
              />
              <TextField
                label={isAr ? "اسم العائلة" : "Last name"}
                value={lastName}
                onChange={setLastName}
                autoComplete="family-name"
              />
            </div>
            <TextField
              label={isAr ? "رقم الجوال (اختياري)" : "Mobile (optional)"}
              value={phone}
              onChange={(v) => setPhone(v.slice(0, 20))}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="05XXXXXXXX"
              dir="ltr"
            />
            <TextField
              label={isAr ? "كلمة المرور" : "Password"}
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              dir="ltr"
              hint={isAr ? "٨ خانات على الأقل، تجمع حروفاً إنجليزية وأرقاماً." : "At least 8 characters, mixing letters (A–Z) and numbers."}
              required
            />
            <TextField
              label={isAr ? "أعد كتابة كلمة المرور" : "Confirm password"}
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              dir="ltr"
              required
            />
            <ErrorBlock error={error} />
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {isAr ? "أنشئ حسابي وانضم للفريق" : "Create my account and join"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/** After accepting: the next step is whatever the clinic's status allows. */
function AcceptedScreen({ accepted, isAr }: { accepted: StaffInviteAccepted; isAr: boolean }) {
  const router = useRouter();
  const orgName = isAr ? accepted.org.nameAr || accepted.org.nameEn : accepted.org.nameEn || accepted.org.nameAr;
  const role = isAr ? accepted.roleLabel.ar : accepted.roleLabel.en;
  const status = accepted.org.status;

  if (status === "LIVE") {
    return (
      <Centered>
        <IconBubble tone="success" size="lg">
          <CheckCircle2 className="size-6" />
        </IconBubble>
        <h1 className="font-display text-xl font-semibold">
          {isAr ? `أنت الآن ضمن فريق ${orgName}` : `You're on the team at ${orgName}`}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? `دورك: ${role}. ما تراه وما تستطيع فعله مبني على هذا الدور — لا شيء مخفي خلف أزرار معطّلة.`
            : `Your role: ${role}. What you see and what you can do follows from it — nothing hidden behind disabled buttons.`}
        </p>
        <Button onClick={() => router.replace("/vet")} size="lg">
          {isAr ? "ابدأ العمل" : "Start working"}
        </Button>
      </Centered>
    );
  }

  if (status === "APPROVED") {
    return (
      <Centered>
        <IconBubble tone="success" size="lg">
          <CheckCircle2 className="size-6" />
        </IconBubble>
        <h1 className="font-display text-xl font-semibold">
          {isAr ? `أهلاً بك في فريق ${orgName}` : `Welcome to the team at ${orgName}`}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? `دورك: ${role}. العيادة معتمدة وتُكمل تجهيزها الآن، وتُفتح سجلات الأعضاء بعد التفعيل. خطوتك المفيدة الآن: عيّن رمزك السري للكاونتر.`
            : `Your role: ${role}. The clinic is approved and finishing its setup — member records open once it goes live. The useful thing to do now: set your counter PIN.`}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => router.replace("/vet/settings#pin")} size="lg">
            {isAr ? "عيّن رمزي السري" : "Set my counter PIN"}
          </Button>
          <Button onClick={() => router.replace("/vet")} size="lg" variant="ghost">
            {isAr ? "افتح البوابة" : "Open the portal"}
          </Button>
        </div>
      </Centered>
    );
  }

  return (
    <Centered>
      <IconBubble tone="info" size="lg">
        <Clock className="size-6" />
      </IconBubble>
      <h1 className="font-display text-xl font-semibold">{isAr ? "حسابك جاهز" : "Your account is ready"}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {isAr
          ? `انضممت إلى ${orgName} بدور ${role}. العيادة قيد المراجعة لدى مرقط — سنرسل لك بريداً حين تصبح فعّالة، ولا شيء مطلوب منك حتى ذلك الحين.`
          : `You've joined ${orgName} as ${role}. The clinic is under review by Moracat — we'll email you when it's live, and nothing is needed from you until then.`}
      </p>
      <Link href="/">
        <Button size="lg" variant="outline">
          {isAr ? "تعرّف على مرقط" : "Explore Moracat"}
        </Button>
      </Link>
    </Centered>
  );
}


function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[60vh] w-full max-w-md place-items-center px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">{children}</div>
    </div>
  );
}

function IconBubble({
  tone,
  size = "md",
  children,
}: {
  tone: "info" | "primary" | "success";
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl",
        size === "lg" ? "size-14" : "size-11",
        tone === "info" && "bg-info/12 text-info",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "success" && "bg-success/12 text-success",
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

function ErrorBlock({ error }: { error: Friendly }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5">
      <p className="text-sm font-medium text-destructive">{error.title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{error.message}</p>
    </div>
  );
}

function ReadOnlyEmail({ email, isAr }: { email: string; isAr: boolean }) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {isAr ? "البريد الإلكتروني" : "Email"}
      </label>
      <Input id={id} value={email} readOnly dir="ltr" className="bg-muted/50 text-start text-muted-foreground" />
      <p className="text-xs text-muted-foreground">
        {isAr ? "البريد الذي وصلته الدعوة — لتغييره اطلب دعوة جديدة." : "The address the invitation went to — to change it, ask for a new invitation."}
      </p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
  placeholder,
  autoComplete,
  inputMode,
  dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  dir?: "ltr" | "rtl";
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && (
          <span className="ms-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        dir={dir}
        className={dir === "ltr" ? "text-start" : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
