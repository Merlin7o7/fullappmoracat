"use client";

/**
 * /vet/register — the front door of clinic registration (MRC-VET-002 phase 2).
 *
 * Resolves who is here and which clinic they're registering, then hands over
 * to the wizard. The paths, all of which must end somewhere useful (R084):
 *   • invitation link, no account yet      → create the owner account inline
 *   • invitation link, account exists      → sign in with the invited email
 *   • invitation link, signed in           → claim (idempotent) and continue
 *   • invitation link, signed in as other  → explain, offer to switch account
 *   • no link, signed in                   → the registrations this person owns
 *   • no link, signed out                  → open the email link, or sign in
 *
 * Once a clinic is resolved the token leaves the address bar (replaced by
 * `?org=`), so a reload, a screenshot or a shared tab never carries it.
 */

import * as React from "react";
import Link from "next/link";
import { Building2, ChevronRight, Loader2, LogOut, MailQuestion, ShieldCheck, UserRoundX } from "lucide-react";
import { Button, Card, buttonVariants, cn } from "@moraqat/ui";
import { CLINIC_STATUS_LABELS, REGISTRATION_STEPS, normalizeSaudiMobile } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import {
  createOwnerAccount,
  previewRegistrationInvite,
  registrationError,
  useRegistrationApi,
  type MyRegistration,
  type RegFriendlyError,
  type RegistrationPreview,
} from "@/lib/vet-registration";
import { IlloCat, IlloHeart } from "@/components/illustrations";
import { InviteSignIn } from "@/components/vet/invite-sign-in";
import { PARTNERS_EMAIL } from "./status-screens";
import { Centered, ErrorNote, TextField } from "./ui";
import { RegistrationWizard } from "./wizard-shell";

type UrlParams = { token: string | null; org: string | null };

const LOGIN_NEXT = "/vet/login?next=%2Fvet%2Fregister";

function setOrgInUrl(orgId: string) {
  try {
    window.history.replaceState(window.history.state, "", `/vet/register?org=${encodeURIComponent(orgId)}`);
  } catch {
    /* ignore */
  }
}

export function RegistrationEntry() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { user, ready } = useAuth();
  const api = useRegistrationApi();

  const [params, setParams] = React.useState<UrlParams | undefined>(undefined);
  const [orgId, setOrgId] = React.useState<string | null>(null);

  // Read at mount (no Suspense boundary needed; the token never leaves this client).
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setParams({ token: q.get("token"), org: q.get("org") });
  }, []);

  const openOrg = React.useCallback((id: string) => {
    setOrgId(id);
    setOrgInUrl(id);
  }, []);

  if (params === undefined || !ready) return <Loading isAr={isAr} />;

  if (orgId && user) return <RegistrationWizard key={orgId} orgId={orgId} isAr={isAr} />;

  if (params.token) {
    return <InviteFlow token={params.token} isAr={isAr} onResolved={openOrg} />;
  }

  if (!user) return <NoLinkSignedOut isAr={isAr} />;

  if (params.org) return <RegistrationWizard key={params.org} orgId={params.org} isAr={isAr} />;

  return <MyRegistrations isAr={isAr} api={api} onOpen={openOrg} />;
}

/* ── Invitation link ───────────────────────────────────────────────────── */

function InviteFlow({ token, isAr, onResolved }: { token: string; isAr: boolean; onResolved: (orgId: string) => void }) {
  const { user, logout } = useAuth();
  const api = useRegistrationApi();
  const [preview, setPreview] = React.useState<RegistrationPreview | null>(null);
  const [previewError, setPreviewError] = React.useState<RegFriendlyError | null>(null);
  const [claimError, setClaimError] = React.useState<RegFriendlyError | null>(null);
  const [claiming, setClaiming] = React.useState(false);
  const [mode, setMode] = React.useState<"create" | "signin" | null>(null);
  const resolvedRef = React.useRef(false);

  React.useEffect(() => {
    let alive = true;
    previewRegistrationInvite(token)
      .then((p) => {
        if (!alive) return;
        setPreview(p);
        setMode(p.accountExists || p.claimed ? "signin" : "create");
      })
      .catch((err) => alive && setPreviewError(registrationError(err, isAr)));
    return () => {
      alive = false;
    };
    // isAr only shapes the error copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const emailMatches = !!user && !!preview && user.email.toLowerCase() === preview.email.toLowerCase();

  const claim = React.useCallback(async () => {
    if (resolvedRef.current) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await api.claim(token);
      resolvedRef.current = true;
      onResolved(res.orgId);
    } catch (err) {
      setClaimError(registrationError(err, isAr));
    } finally {
      setClaiming(false);
    }
  }, [api, token, onResolved, isAr]);

  // Signed in with the invited address → claim and continue (idempotent on the API).
  React.useEffect(() => {
    if (emailMatches && !resolvedRef.current && !claiming && !claimError) void claim();
  }, [emailMatches, claiming, claimError, claim]);

  if (previewError) {
    return (
      <Centered>
        <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground" aria-hidden>
          <MailQuestion className="size-5" />
        </span>
        <h1 className="font-display text-xl font-semibold">{previewError.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{previewError.message}</p>
        <p className="text-xs text-muted-foreground">
          {isAr ? "تحتاج رابطاً جديداً؟ راسلنا على " : "Need a new link? Write to "}
          <a href={`mailto:${PARTNERS_EMAIL}`} dir="ltr" className="font-medium text-primary underline-offset-4 hover:underline">
            {PARTNERS_EMAIL}
          </a>
        </p>
        <Link href={LOGIN_NEXT} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {isAr ? "لدي حساب — تسجيل الدخول" : "I have an account — sign in"}
        </Link>
      </Centered>
    );
  }

  if (!preview) return <Loading isAr={isAr} label={isAr ? "نفتح دعوتكم…" : "Opening your invitation…"} />;

  const clinicName = isAr ? preview.orgName.ar || preview.orgName.en : preview.orgName.en || preview.orgName.ar;

  /* Signed in, but as someone else. */
  if (user && !emailMatches) {
    return (
      <Centered>
        <span className="grid size-12 place-items-center rounded-2xl bg-warning/15 text-[hsl(38_92%_30%)] dark:text-warning-ink" aria-hidden>
          <UserRoundX className="size-5" />
        </span>
        <h1 className="font-display text-xl font-semibold">{isAr ? "أنت مسجّل بحساب آخر" : "You're signed in as someone else"}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr ? "دعوة " : "The invitation for "}
          <span className="font-medium text-foreground">{clinicName}</span>
          {isAr ? " أُرسلت إلى " : " was sent to "}
          <span dir="ltr" className="font-medium text-foreground">
            {preview.email}
          </span>
          {isAr ? "، وأنت داخل بـ " : ", but you're signed in as "}
          <span dir="ltr" className="font-medium text-foreground">
            {user.email}
          </span>
          {isAr
            ? ". حساب المالك يجب أن يكون بالبريد الذي وصلته الدعوة — سجّل الخروج ثم تابع."
            : ". The owner account has to use the invited email — sign out, then continue."}
        </p>
        <Button size="lg" onClick={() => void logout()}>
          <LogOut aria-hidden />
          {isAr ? "سجّل الخروج وتابع" : "Sign out and continue"}
        </Button>
      </Centered>
    );
  }

  /* Signed in with the right email — claiming. */
  if (user && emailMatches) {
    if (claimError) {
      return (
        <Centered>
          <ErrorNote error={claimError} className="w-full text-start" />
          <Button variant="outline" onClick={() => setClaimError(null)}>
            {isAr ? "حاول مجدداً" : "Try again"}
          </Button>
        </Centered>
      );
    }
    return <Loading isAr={isAr} label={isAr ? "نجهّز تسجيل عيادتكم…" : "Getting your clinic registration ready…"} />;
  }

  /* Signed out. */
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-8 sm:py-12">
      <InviteWelcome isAr={isAr} clinicName={clinicName} preview={preview} />
      {mode === "signin" ? (
        <Card className="p-4 sm:p-6">
          {/* Only the sign-in doors this account really has — a Google-created
              account has no password (production, 2026-09-16). Once a session
              exists, the signed-in branch above claims the clinic. */}
          <InviteSignIn
            isAr={isAr}
            email={preview.email}
            methods={preview.signIn}
            onSignedIn={() => undefined}
            submitLabel={{ ar: "دخول ومتابعة التسجيل", en: "Sign in and continue" }}
          />
          {!(preview.accountExists || preview.claimed) && (
            <button
              type="button"
              onClick={() => setMode("create")}
              className="mx-auto mt-2 flex min-h-[44px] items-center text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {isAr ? "ليس لدي حساب" : "I don't have an account"}
            </button>
          )}
        </Card>
      ) : (
        <CreateAccountCard
          isAr={isAr}
          token={token}
          preview={preview}
          onResolved={(id) => {
            resolvedRef.current = true;
            onResolved(id);
          }}
          onAccountExists={() => setMode("signin")}
        />
      )}
    </div>
  );
}

function InviteWelcome({ isAr, clinicName, preview }: { isAr: boolean; clinicName: string; preview: RegistrationPreview }) {
  const first = REGISTRATION_STEPS.find((s) => s.key === "account");
  return (
    <div className="relative flex flex-col gap-2">
      <span aria-hidden className="pointer-events-none absolute -top-3 end-0 flex items-end gap-1">
        <IlloCat tone="green" className="size-14" />
        <IlloHeart tone="orange" className="mb-6 size-6 -rotate-12" />
      </span>
      <p className="text-xs font-medium text-muted-foreground">
        {isAr ? `الخطوة ١ من ${REGISTRATION_STEPS.length} · ${first?.ar ?? ""}` : `Step 1 of ${REGISTRATION_STEPS.length} · ${first?.en ?? ""}`}
      </p>
      <h1 className="max-w-[80%] font-display text-2xl font-semibold leading-tight sm:text-3xl">
        {isAr ? `أهلاً بـ ${clinicName} في شبكة مرقط` : `Welcome, ${clinicName}, to the Moracat network`}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {isAr
          ? "التسجيل يأخذ نحو ١٥ دقيقة: بيانات السجل، الفروع، المستندات، الفريق، ثم التوقيع. كل ما تكتبه يُحفظ، فتقدر تكمل لاحقاً من أي جهاز."
          : "Registration takes about 15 minutes: CR details, branches, documents, team, then signing. Everything you enter is saved, so you can finish later on any device."}
      </p>
      <p className="text-xs text-muted-foreground">
        {isAr ? "صلاحية الدعوة حتى " : "Invitation valid until "}
        {new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { dateStyle: "medium" }).format(new Date(preview.expiresAt))}
      </p>
    </div>
  );
}

const PASSWORD_OK = (p: string) => p.length >= 8 && /[A-Za-z؀-ۿ]/.test(p) && /\d/.test(p);

function CreateAccountCard({
  isAr,
  token,
  preview,
  onResolved,
  onAccountExists,
}: {
  isAr: boolean;
  token: string;
  preview: RegistrationPreview;
  onResolved: (orgId: string) => void;
  onAccountExists: () => void;
}) {
  const { adoptSession } = useAuth();
  const [first, ...rest] = (preview.contactName ?? "").trim().split(/\s+/);
  const [firstName, setFirstName] = React.useState(first ?? "");
  const [lastName, setLastName] = React.useState(rest.join(" "));
  const [phone, setPhone] = React.useState(preview.contactPhone ?? "");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [attempted, setAttempted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<RegFriendlyError | null>(null);

  const errors = attempted
    ? {
        firstName: firstName.trim() ? undefined : isAr ? "اكتب اسمك الأول." : "Enter your first name.",
        phone: normalizeSaudiMobile(phone) ? undefined : isAr ? "اكتب رقم جوال سعودي مثل 05XXXXXXXX." : "Enter a Saudi mobile like 05XXXXXXXX.",
        password: PASSWORD_OK(password)
          ? undefined
          : isAr
            ? "٨ أحرف على الأقل، تجمع حروفاً وأرقاماً."
            : "At least 8 characters, with letters and numbers.",
        confirm: confirm === password ? undefined : isAr ? "كلمتا المرور غير متطابقتين." : "The passwords don't match.",
      }
    : {};

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setError(null);
    if (!firstName.trim() || !normalizeSaudiMobile(phone) || !PASSWORD_OK(password) || confirm !== password) return;
    setBusy(true);
    try {
      const res = await createOwnerAccount({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: normalizeSaudiMobile(phone) ?? phone,
        password,
      });
      // Resolve the clinic before adopting the session so the signed-in
      // branch doesn't race to claim a link this call already claimed.
      onResolved(res.registration.orgId);
      adoptSession(res);
    } catch (err) {
      const friendly = registrationError(err, isAr);
      if (friendly.code === "EMAIL_TAKEN" || friendly.code === "VET_INVITE_USED") onAccountExists();
      setError(friendly);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{isAr ? "أنشئ حساب المالك" : "Create the owner account"}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "حسابك الشخصي — به تدير العيادة وتدعو فريقك. بريدك مؤكَّد لأنك فتحت الرابط منه."
              : "Your personal account — you'll run the clinic and invite your team with it. Your email is confirmed because you opened the link from it."}
          </p>
        </div>
        <TextField
          isAr={isAr}
          label={isAr ? "البريد الإلكتروني" : "Email"}
          value={preview.email}
          onChange={() => undefined}
          readOnly
          dir="ltr"
          hint={isAr ? "البريد الذي وصلته الدعوة." : "The address the invitation was sent to."}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            isAr={isAr}
            label={isAr ? "الاسم الأول" : "First name"}
            value={firstName}
            onChange={setFirstName}
            error={errors.firstName}
            required
            autoComplete="given-name"
            maxLength={80}
          />
          <TextField
            isAr={isAr}
            label={isAr ? "اسم العائلة" : "Last name"}
            value={lastName}
            onChange={setLastName}
            optional
            autoComplete="family-name"
            maxLength={80}
          />
        </div>
        <TextField
          isAr={isAr}
          type="tel"
          label={isAr ? "رقم الجوال" : "Mobile number"}
          value={phone}
          onChange={setPhone}
          error={errors.phone}
          required
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          placeholder="05XXXXXXXX"
          maxLength={20}
        />
        <TextField
          isAr={isAr}
          type="password"
          label={isAr ? "كلمة المرور" : "Password"}
          value={password}
          onChange={setPassword}
          error={errors.password}
          hint={isAr ? "٨ أحرف على الأقل، تجمع حروفاً وأرقاماً." : "At least 8 characters, with letters and numbers."}
          required
          dir="ltr"
          autoComplete="new-password"
          maxLength={128}
        />
        <TextField
          isAr={isAr}
          type="password"
          label={isAr ? "أعد كتابة كلمة المرور" : "Confirm password"}
          value={confirm}
          onChange={setConfirm}
          error={errors.confirm}
          required
          dir="ltr"
          autoComplete="new-password"
          maxLength={128}
        />
        <ErrorNote error={error} />
        <Button type="submit" size="lg" loading={busy} className="w-full">
          {isAr ? "أنشئ الحساب وابدأ التسجيل" : "Create account and start"}
        </Button>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {isAr
            ? "لا يُرسل أي شيء للمراجعة قبل أن توقّع في الخطوة الأخيرة."
            : "Nothing is sent for review until you sign at the last step."}
        </p>
      </form>
    </Card>
  );
}


/* ── No link ───────────────────────────────────────────────────────────── */

function NoLinkSignedOut({ isAr }: { isAr: boolean }) {
  return (
    <Centered>
      <span className="grid size-12 place-items-center rounded-2xl bg-info/12 text-info" aria-hidden>
        <MailQuestion className="size-5" />
      </span>
      <h1 className="font-display text-xl font-semibold">{isAr ? "افتح رابط الدعوة من بريدك" : "Open the invitation link from your email"}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {isAr
          ? "تسجيل العيادات في مرقط بالدعوة فقط. إن بدأت التسجيل سابقاً، سجّل دخولك لتكمل من حيث توقفت."
          : "Clinic registration on Moracat is by invitation. If you've already started, sign in to pick up where you left off."}
      </p>
      <Link href={LOGIN_NEXT} className={buttonVariants({ size: "lg" })}>
        {isAr ? "تسجيل الدخول" : "Sign in"}
      </Link>
      <Link href="/vet/apply" className="inline-flex min-h-[44px] items-center text-xs font-medium text-primary underline-offset-4 hover:underline">
        {isAr ? "لم تصلك دعوة؟ قدّم طلب انضمام" : "No invitation? Apply to join"}
      </Link>
    </Centered>
  );
}

function MyRegistrations({
  isAr,
  api,
  onOpen,
}: {
  isAr: boolean;
  api: ReturnType<typeof useRegistrationApi>;
  onOpen: (id: string) => void;
}) {
  const { logout } = useAuth();
  const [items, setItems] = React.useState<MyRegistration[] | null>(null);
  const [error, setError] = React.useState<RegFriendlyError | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setError(null);
    api
      .mine()
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        const only = res.items.length === 1 ? res.items[0] : undefined;
        // One registration is not a choice — open it.
        if (only) onOpen(only.id);
      })
      .catch((err) => alive && setError(registrationError(err, isAr)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, attempt]);

  if (error) {
    return (
      <Centered>
        <ErrorNote error={error} className="w-full text-start" />
        <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          {isAr ? "حاول مجدداً" : "Try again"}
        </Button>
      </Centered>
    );
  }

  if (!items || items.length === 1) return <Loading isAr={isAr} />;

  if (items.length === 0) {
    return (
      <Centered>
        <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
          <Building2 className="size-5" />
        </span>
        <h1 className="font-display text-xl font-semibold">{isAr ? "لا يوجد تسجيل عيادة باسمك" : "No clinic registration under your account"}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "تسجيل العيادات في مرقط بالدعوة فقط. إن وصلتك دعوة، افتح الرابط من البريد نفسه. لطلب دعوة راسلنا على "
            : "Clinic registration on Moracat is by invitation. If you received one, open the link from that email. To request one, write to "}
          <a href={`mailto:${PARTNERS_EMAIL}`} dir="ltr" className="font-medium text-primary underline-offset-4 hover:underline">
            {PARTNERS_EMAIL}
          </a>
          .
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link href="/vet/apply" className={buttonVariants({ size: "sm" })}>
            {isAr ? "قدّم طلب انضمام" : "Apply to join"}
          </Link>
          <Button size="sm" variant="ghost" onClick={() => void logout()}>
            <LogOut aria-hidden />
            {isAr ? "دخول بحساب آخر" : "Use another account"}
          </Button>
        </div>
      </Centered>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-10">
      <div>
        <h1 className="font-display text-xl font-semibold">{isAr ? "أي عيادة تكمل تسجيلها؟" : "Which clinic are you registering?"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr ? "لديك أكثر من تسجيل باسمك." : "You have more than one registration on this account."}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onOpen(r.id)}
              className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-start transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{isAr ? r.nameAr || r.nameEn : r.nameEn || r.nameAr}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {(r.statusLabel ?? CLINIC_STATUS_LABELS[r.status])[isAr ? "ar" : "en"]}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Loading({ isAr, label }: { isAr: boolean; label?: string }) {
  return (
    <Centered>
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {label ?? (isAr ? "لحظة…" : "One moment…")}
      </p>
    </Centered>
  );
}
