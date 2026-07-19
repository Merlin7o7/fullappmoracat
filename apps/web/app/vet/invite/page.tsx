"use client";

/**
 * Accepting a clinic invitation (MRC-VET-001 §02).
 *
 * The invite is where a colleague becomes accountable: from here on, every
 * record they read and every benefit they apply carries their name. So the one
 * thing this page insists on is the confidentiality acknowledgement — one
 * screen, plain language, no legalese wall. Everything else gets out of the
 * way: an invited nurse should be inside her clinic in well under a minute.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, MailQuestion, ShieldCheck } from "lucide-react";
import { Button, Card, cn, useToast } from "@moraqat/ui";
import { VET_ROLE_LABELS } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { rememberVetOrg, vetFriendlyError, vetOrgName, type VetInviteResult } from "@/lib/vet-api";

export default function VetInvitePage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const { toast } = useToast();
  const { user, ready, authedFetch } = useAuth();

  const [token, setToken] = React.useState<string | null>(null);
  const [agreed, setAgreed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ title: string; message: string } | null>(null);
  const [accepted, setAccepted] = React.useState<VetInviteResult | null>(null);

  // Read from the URL at mount rather than useSearchParams — no Suspense
  // boundary needed, and the token never leaves this client.
  React.useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authedFetch<VetInviteResult>("/vet/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setAccepted(result);
      rememberVetOrg(result.orgId);
      toast({
        title: isAr ? `أهلاً بك في ${vetOrgName(result, true)}` : `Welcome to ${vetOrgName(result, false)}`,
        description: VET_ROLE_LABELS[result.role][isAr ? "ar" : "en"],
        variant: "success",
      });
    } catch (err) {
      setError(vetFriendlyError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  /* ── No token in the link ───────────────────────────────────────────────── */
  if (token === null && ready) {
    return (
      <Centered>
        <span className="grid size-12 place-items-center rounded-2xl bg-info/12 text-info" aria-hidden>
          <MailQuestion className="size-5" />
        </span>
        <h1 className="font-display text-lg font-semibold">
          {isAr ? "هذا الرابط ناقص" : "This link is incomplete"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "افتح الرابط كاملاً من رسالة الدعوة — بعض برامج البريد تقصّه. إذا انتهت مدته، مدير العيادة يرسل واحداً جديداً في ثانيتين."
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
  if (accepted) {
    return (
      <Centered>
        <span className="grid size-14 place-items-center rounded-2xl bg-success/12 text-success" aria-hidden>
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="font-display text-xl font-semibold">
          {isAr ? `أنت الآن ضمن ${vetOrgName(accepted, true)}` : `You're on the team at ${vetOrgName(accepted, false)}`}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? `دورك: ${VET_ROLE_LABELS[accepted.role].ar}. ما تراه وما تستطيع فعله مبني على هذا الدور — لا شيء مخفي خلف أزرار معطّلة.`
            : `Your role: ${VET_ROLE_LABELS[accepted.role].en}. What you see and what you can do follows from it — nothing hidden behind disabled buttons.`}
        </p>
        <Button onClick={() => router.replace("/vet")} size="lg">
          {isAr ? "ابدأ العمل" : "Start working"}
        </Button>
      </Centered>
    );
  }

  /* ── Needs a sign-in first ──────────────────────────────────────────────── */
  if (ready && !user) {
    const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/vet/invite";
    return (
      <Centered>
        <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
          <KeyRound className="size-5" />
        </span>
        <h1 className="font-display text-lg font-semibold">
          {isAr ? "سجّل دخولك لقبول الدعوة" : "Sign in to accept your invitation"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "لكل زميل حساب باسمه — لأن كل ما يُكتب في السجل الطبي يُنسب لشخص. سنعيدك إلى هذه الصفحة مباشرة."
            : "Every colleague signs in as themselves, because everything written into a medical record is attributed to a person. We'll bring you straight back here."}
        </p>
        <Link href={`/vet/login?next=${encodeURIComponent(next)}`}>
          <Button size="lg">{isAr ? "تسجيل الدخول" : "Sign in"}</Button>
        </Link>
      </Centered>
    );
  }

  if (!ready || token === null) {
    return (
      <Centered>
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {isAr ? "نفتح دعوتك…" : "Opening your invitation…"}
        </p>
      </Centered>
    );
  }

  /* ── The acknowledgement ────────────────────────────────────────────────── */
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-10">
      <div>
        <h1 className="font-display text-2xl font-semibold leading-tight">
          {isAr ? "قبل أن تبدأ" : "Before you start"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "صفحة واحدة، بلغة واضحة. هذه هي الأمانة التي يوقّعها كل من يفتح سجلاً طبياً في مرقط."
            : "One page, in plain language. This is the trust every person who opens a medical record on Moracat signs up to."}
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-5">
        <ul className="flex flex-col gap-3 text-sm leading-relaxed">
          {[
            {
              ar: "ما تراه عن قط أو مالكه يخص رعايته فقط — لا يُشارك ولا يُصوَّر ولا يُناقش خارج العيادة.",
              en: "What you see about a cat or its owner is for their care only — never shared, photographed, or discussed outside the clinic.",
            },
            {
              ar: "كل فتح لملف وكل تعديل يُسجَّل باسمك، والمالك يستطيع الاطلاع على هذا السجل.",
              en: "Every profile you open and every change you make is logged to your name — and the owner can read that log.",
            },
            {
              ar: "حسابك لك وحدك. على الجهاز المشترك استخدم رمزك السري بدل مشاركة كلمة المرور.",
              en: "Your account is yours alone. On a shared terminal, use your PIN rather than passing a password around.",
            },
            {
              ar: "إذا تركت العيادة، ينتهي وصولك فوراً — ويبقى اسمك على ما كتبته، لأن السجل الطبي لا يُيتَّم.",
              en: "If you leave the clinic your access ends immediately — and your name stays on what you wrote, because a medical record is never orphaned.",
            },
          ].map((line) => (
            <li key={line.en} className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>{isAr ? line.ar : line.en}</span>
            </li>
          ))}
        </ul>

        <label
          className={cn(
            "mt-1 flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
            agreed ? "border-primary/40 bg-primary/[0.06]" : "border-border hover:bg-muted",
          )}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="size-5 shrink-0 accent-[hsl(var(--primary))]"
          />
          <span>
            {isAr
              ? "قرأت ما سبق وألتزم به، وأفهم أن كل إجراء يُنسب لي."
              : "I've read this and I'll keep to it, and I understand every action is attributed to me."}
          </span>
        </label>

        {error && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5">
            <p className="text-sm font-medium text-destructive">{error.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{error.message}</p>
          </div>
        )}

        <Button size="lg" disabled={!agreed} loading={busy} onClick={() => void accept()} className="w-full">
          {isAr ? "اقبل الدعوة" : "Accept the invitation"}
        </Button>
      </Card>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[60vh] w-full max-w-md place-items-center px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">{children}</div>
    </div>
  );
}
