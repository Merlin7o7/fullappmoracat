"use client";

// ════════════════════════════════════════════════════════════════════════
//  PSP Return — the activation ceremony.
//
//  Redirect rails (Tamara, mada, Apple Pay, STC Pay via hosted pages) send the
//  member back here after they pay. The order settles asynchronously via the
//  PSP webhook, so this page POLLS the order until it resolves, then reveals the
//  cat's Cat ID flipping to *Active* — the product's second ceremony (Stage 4).
//
//  Never a raw list with a "DRAFT" badge: pending is a calm "confirming…", active
//  is a celebration, failed is a dignified retry (R118). The member's saved card
//  becomes the hero of the moment (R031/R073).
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, BellRing, Mail, RefreshCw, Inbox } from "lucide-react";
import { Card, Button } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { commerceEnabled } from "@/lib/features";
import { localizeName } from "@/lib/translit";
import { formatMoneyDate } from "@/lib/money";
import { track } from "@/lib/track";
import { CatIdCard } from "@/components/cat-id-card";
import { LaunchDeliveryNote } from "@/components/launch-note";
import { IlloPaw } from "@/components/illustrations";

interface ActivationStatus {
  orderNumber: string;
  state: "active" | "failed" | "pending";
  grandTotal: number;
  taxTotal: number;
  currency: string;
  nextBillingAt: string | null;
  plan: { tier: string; nameEn: string; nameAr: string } | null;
  cats: { id: string; name: string }[];
}

/** Reassure at 1 minute; stop polling entirely at ~8 minutes — a page that
 *  spins forever is a false promise, an email is a kept one (R112). */
const SLOW_AFTER_MS = 60_000;
const POLL_CAP_MS = 8 * 60_000;

export default function CheckoutReturnPage() {
  return (
    <React.Suspense
      fallback={
        <div className="grid place-items-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ReturnInner />
    </React.Suspense>
  );
}

function ReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get("ref");
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const uiLocale = isAr ? ("ar" as const) : ("en" as const);
  const qc = useQueryClient();
  const { activeCats } = useCats();

  // Commerce-facing surface must be unreachable in Community Mode — a stale
  // bookmark or a crafted ?ref= must never flash "Confirming your payment…"
  // when no payment can exist (R040). Mirrors checkout/page.tsx.
  const commerceOn = commerceEnabled();
  React.useEffect(() => {
    if (!commerceOn) router.replace("/portal");
  }, [commerceOn, router]);

  // No reference to poll — nothing to confirm. Back to the portal.
  React.useEffect(() => {
    if (!ref) router.replace("/portal");
  }, [ref, router]);

  // Poll while the webhook settles — but never forever. Past the cap the page
  // stops asking and hands the promise to email + the subscriptions page.
  const [startedAt] = React.useState(() => Date.now());
  const [timedOut, setTimedOut] = React.useState(false);

  const { data, isError } = useQuery({
    queryKey: ["activation", ref],
    queryFn: () => authedFetch<ActivationStatus>(`/subscriptions/order-status/${ref}`),
    enabled: commerceOn && !!user && !!ref && !timedOut,
    refetchInterval: (q) => {
      if (q.state.data?.state !== "pending") return false;
      if (Date.now() - startedAt >= POLL_CAP_MS) return false;
      return 2500;
    },
  });

  React.useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), POLL_CAP_MS);
    return () => window.clearTimeout(t);
  }, []);

  // The moment it goes live, refresh the portal so the Cat ID reads Active
  // everywhere the member looks next.
  React.useEffect(() => {
    if (data?.state === "active") {
      void qc.invalidateQueries({ queryKey: ["cats"] });
      void qc.invalidateQueries({ queryKey: ["subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
      // Paid activation confirmed — the commerce conversion (lib/track.ts).
      track("membership_activated");
    }
  }, [data?.state, qc]);

  // After a while with no settlement, reassure rather than spin silently.
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, []);

  const catLine = (data?.cats ?? [])
    .map((c) => localizeName(c.name, uiLocale))
    .join(isAr ? "، " : ", ");

  // If the order carries enough to rebuild the checkout, retrying lands the
  // member back mid-flow with their plan + cat intact (R117), not at zero.
  const retryHref = React.useMemo(() => {
    if (!data?.plan?.tier) return "/portal/subscribe";
    const cat = data.cats[0]?.id;
    return `/portal/checkout?plan=${data.plan.tier}${cat ? `&cat=${cat}` : ""}`;
  }, [data]);

  // Every hook has run — safe to bail before painting anything commercial.
  if (!commerceOn) return null;

  // ── Couldn't find the order ────────────────────────────────────────────────
  if (isError) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          {isAr ? "ما لقينا هذي العملية. تحقق من اشتراكاتك." : "We couldn't find this payment. Check your subscriptions."}
        </p>
        <Button className="mt-5" onClick={() => router.push("/portal/subscriptions")}>
          {isAr ? "اشتراكاتي" : "My subscriptions"}
        </Button>
      </Shell>
    );
  }

  // ── Active — the ceremony ──────────────────────────────────────────────────
  if (data?.state === "active") {
    const covered = activeCats.find((c) => c.id === data.cats[0]?.id);
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="relative overflow-hidden p-8 text-center sm:p-10">
          <IlloPaw tone="sage" className="pointer-events-none absolute start-8 top-6 size-7 rotate-[-14deg] opacity-50" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />

          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="mx-auto grid size-16 place-items-center rounded-full bg-success/15 text-success"
          >
            <CheckCircle2 className="size-8" />
          </motion.span>

          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isAr ? `عضوية ${catLine} صارت مفعّلة 🎉` : `${catLine}'s membership is now active 🎉`}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {data.plan
              ? isAr
                ? `باقة «${data.plan.nameAr}» — وهويتهم صارت فعّالة رسمياً.`
                : `The ${data.plan.nameEn} plan — and their Cat ID is officially active.`
              : isAr
                ? "وهويتهم صارت فعّالة رسمياً."
                : "And their Cat ID is officially active."}
          </p>

          {/* The saved card, now Active — the hero of the moment. */}
          {covered && (
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 22 }}
              className="mx-auto mt-6 w-[min(24rem,100%)]"
            >
              <CatIdCard
                catName={covered.name}
                catIdNumber={covered.catIdNumber ?? "MRC-••••-••••"}
                issuedAt={covered.idIssuedAt}
                photoUrl={covered.photoUrl}
                isAr={isAr}
                membershipActive
                qrToken={covered.qrToken}
              />
            </motion.div>
          )}

          <div className="mx-auto mt-6 max-w-sm space-y-2 text-start text-sm">
            <p className="flex items-start gap-2 text-muted-foreground">
              <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {isAr ? "الإيصال في طريقه إلى " : "Your receipt is on its way to "}
                <span dir="ltr" className="font-medium text-foreground">{user?.email}</span>
              </span>
            </p>
            {data.nextBillingAt && (
              <p className="flex items-start gap-2 text-muted-foreground">
                <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {isAr
                    ? `مدتكم مدفوعة حتى ${formatMoneyDate(data.nextBillingAt, true)} — بدون أي تجديد تلقائي؛ ندعوك قبل نهايتها.`
                    : `Your term is paid through ${formatMoneyDate(data.nextBillingAt, false)} — no automatic renewal; we'll invite you before it ends.`}
                </span>
              </p>
            )}
          </div>

          {/* Reinforce the founding-member first-delivery date after checkout. */}
          <LaunchDeliveryNote isAr={isAr} className="mx-auto mt-6 max-w-md text-start" />

          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={() => router.push("/portal")}>
              {isAr ? "إلى بوابتك" : "Go to your portal"}
            </Button>
            <Button variant="outline" size="lg" onClick={() => router.push("/portal/subscriptions")}>
              {isAr ? "إدارة اشتراكك" : "Manage your subscription"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Failed — dignified retry (R118) ────────────────────────────────────────
  if (data?.state === "failed") {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {isAr ? "ما اكتملت عملية الدفع" : "The payment didn't complete"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "ما انخصم منك شيء. تقدر تجرّب مرة ثانية متى ما كنت جاهزاً — وهوية قطك بأمان."
            : "Nothing was charged. You can try again whenever you're ready — your cat's ID is safe."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button size="lg" onClick={() => router.push(retryHref)}>
            {isAr ? "جرّب مرة ثانية" : "Try again"}
          </Button>
          <Button variant="outline" size="lg" onClick={() => router.push("/portal/support")}>
            {isAr ? "تواصل مع الدعم" : "Contact support"}
          </Button>
        </div>
      </Shell>
    );
  }

  // ── Poll cap reached — a calm terminal state, the promise moves to email ───
  if (timedOut) {
    return (
      <Shell>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Inbox className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-xl font-bold tracking-tight sm:text-2xl">
          {isAr ? "ما زلنا نؤكّد عملية الدفع" : "We're still confirming your payment"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "التأكيد أخذ وقتاً أطول من المعتاد — ما يحتاج تنتظر هنا. سنرسل لك بريداً لحظة اكتماله، وتقدر تتابع حالته من صفحة اشتراكاتك في أي وقت."
            : "This is taking longer than usual — you don't need to wait here. We'll email you the moment it settles, and you can check its status on your subscriptions page anytime."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button size="lg" onClick={() => router.push("/portal/subscriptions")}>
            {isAr ? "اشتراكاتي" : "My subscriptions"}
          </Button>
          <Button variant="outline" size="lg" onClick={() => router.push("/portal/support")}>
            {isAr ? "تواصل مع العناية" : "Contact Care"}
          </Button>
        </div>
      </Shell>
    );
  }

  // ── Pending — confirming payment ───────────────────────────────────────────
  return (
    <Shell>
      <motion.span
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
        className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary"
      >
        <RefreshCw className="size-6 animate-spin" style={{ animationDuration: "1.6s" }} />
      </motion.span>
      <h1 className="mt-5 font-display text-xl font-bold tracking-tight sm:text-2xl">
        {isAr ? "نأكّد عملية الدفع…" : "Confirming your payment…"}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {catLine
          ? isAr
            ? `لحظات وتصير عضوية ${catLine} مفعّلة — لا تغلق الصفحة.`
            : `A moment and ${catLine}'s membership goes live — please don't close this page.`
          : isAr
            ? "لحظات ونأكّد تفعيل عضويتك."
            : "A moment while we confirm your activation."}
      </p>
      {slow && (
        <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-muted-foreground/80">
          {isAr
            ? "أطول من المعتاد شوي — نكمّل التأكيد، ولو تأخّر نرسل لك بريد أول ما تُفعّل. تقدر تتابع من اشتراكاتك."
            : "This is taking a little longer than usual — we're still confirming, and we'll email you the moment it's active. You can also check your subscriptions."}
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="relative overflow-hidden p-8 text-center sm:p-12">{children}</Card>
    </div>
  );
}
