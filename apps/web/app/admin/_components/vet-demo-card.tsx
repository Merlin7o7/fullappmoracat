"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Copy, KeyRound, Loader2, LogOut, Stethoscope } from "lucide-react";
import { Badge, Button, Card, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Illo3D } from "@/components/illo-3d";
import { rememberVetOrg } from "@/lib/vet-api";
import { friendlyMessage } from "@/lib/errors";

interface DemoStatus {
  provisioned: boolean;
  orgId?: string;
  nameAr?: string;
  nameEn?: string;
  inside: boolean;
  branches?: number;
  staff?: number;
  patients?: number;
}

interface DemoEntry {
  orgId: string;
  nameAr: string;
  nameEn: string;
  credentials: { password: string; pin: string; accounts: { email: string; role: string }[] };
}

/**
 * "Vet Demo" — the admin's door into a working, fictional clinic.
 *
 * WHY IT IS A CARD AND NOT A NAV LINK
 * Entering grants a real PartnerStaff membership at a demo clinic, and that is
 * worth stating before it happens rather than discovering afterwards. The card
 * says what it will do, what it is isolated from, and how to come back — then
 * does it in one tap (R004 trust precedes the ask, R006 honest by default).
 *
 * WHAT MAKES IT SAFE (and why the copy says so out loud)
 * The demo clinic is flagged `isDemo`, and the API's clinic guard quarantines
 * such an org so it can only ever resolve demo cats — patient search, scan,
 * emergency, all of it. An admin inside the demo is therefore not holding a
 * lookup tool over real members' medical records, which is exactly what an
 * unquarantined demo account would be.
 */
export function VetDemoCard() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { authedFetch } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [creds, setCreds] = React.useState<DemoEntry["credentials"] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const status = useQuery({
    queryKey: ["vet-demo-status"],
    queryFn: () => authedFetch<DemoStatus>("/admin/vet-demo"),
    // The demo is a staff convenience, not a metric — a failed read must never
    // put an error state on the dashboard.
    retry: false,
  });

  const enter = useMutation({
    mutationFn: () => authedFetch<DemoEntry>("/admin/vet-demo/enter", { method: "POST" }),
    onSuccess: (res) => {
      // Point the portal's org switcher at the demo clinic before we land
      // there, so it opens on the demo rather than asking which clinic.
      rememberVetOrg(res.orgId);
      setCreds(res.credentials);
      toast({
        title: isAr ? "العيادة التجريبية جاهزة" : "The demo clinic is ready",
        description: isAr
          ? "دخلناك كمالك للعيادة. بياناتها كلها وهمية."
          : "You're in as the clinic's owner. Every record in it is fictional.",
      });
      router.push("/vet");
    },
    onError: (err) => setError(friendlyMessage(err, isAr)),
  });

  const leave = useMutation({
    mutationFn: () => authedFetch("/admin/vet-demo/leave", { method: "POST" }),
    onSuccess: () => {
      toast({ title: isAr ? "خرجت من العيادة التجريبية" : "You've left the demo clinic" });
      void status.refetch();
    },
  });

  const inside = status.data?.inside ?? false;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {/* The one 3D object on the admin dashboard — it marks the single
            screen here that isn't a number. */}
        <span className="relative grid size-20 shrink-0 place-items-center">
          <span aria-hidden className="absolute size-16 rounded-full bg-primary/10 blur-xl" />
          <Illo3D name="can" px={80} className="relative size-20" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight">
              {isAr ? "العيادة التجريبية" : "Vet Demo"}
            </h2>
            <Badge variant="secondary" className="gap-1">
              <Stethoscope className="size-3" aria-hidden />
              {isAr ? "بيانات وهمية" : "Fictional data"}
            </Badge>
            {inside && <Badge variant="default">{isAr ? "أنت داخلها" : "You're in"}</Badge>}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "بوابة العيادات كاملة — مرضى بسجلات حقيقية الشكل، زيارة مفتوحة، ومستويات موافقة مختلفة. معزولة تماماً: العيادة التجريبية ما تقدر تشوف أي قط حقيقي."
              : "The whole partner portal — patients with real-looking histories, an open visit, and three different consent tiers. Fully quarantined: a demo clinic can never reach a real member's cat."}
          </p>
          {status.data?.provisioned && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {isAr
                ? `${status.data.staff ?? 0} موظفين · ${status.data.branches ?? 0} فروع · ${status.data.patients ?? 0} مريض تجريبي`
                : `${status.data.staff ?? 0} staff · ${status.data.branches ?? 0} branches · ${status.data.patients ?? 0} demo patients`}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <Button
            onClick={() => {
              setError(null);
              enter.mutate();
            }}
            disabled={enter.isPending}
          >
            {enter.isPending ? <Loader2 className="size-4 animate-spin" /> : <Stethoscope className="size-4" />}
            {inside ? (isAr ? "افتح البوابة" : "Open the portal") : isAr ? "افتح العرض التجريبي" : "Open Vet Demo"}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Button>
          {inside && (
            <Button variant="ghost" size="sm" onClick={() => leave.mutate()} disabled={leave.isPending}>
              {leave.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              {isAr ? "اخرج من التجريبية" : "Leave the demo"}
            </Button>
          )}
        </div>
      </div>

      {/* Shown once, right after entering: the shared logins, so a demo can be
          handed to a colleague or a prospective partner without a shell. */}
      {creds && <Credentials creds={creds} isAr={isAr} />}
    </Card>
  );
}

function Credentials({ creds, isAr }: { creds: DemoEntry["credentials"]; isAr: boolean }) {
  const { toast } = useToast();
  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value).then(
      () => toast({ title: isAr ? "نُسخ" : "Copied" }),
      () => undefined
    );
  };
  return (
    <div className="border-t border-border bg-muted/40 p-5">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <KeyRound className="size-4 text-muted-foreground" aria-hidden />
        {isAr ? "حسابات العيادة التجريبية" : "Demo clinic logins"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {isAr
          ? "لو تبي تعطي أحداً جولة بدوره الخاص — كل الحسابات بنفس كلمة المرور ونفس رمز الكاونتر."
          : "For giving someone a tour in a specific role — every account shares one password and one counter PIN."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <CopyChip label={isAr ? "كلمة المرور" : "Password"} value={creds.password} onCopy={copy} />
        <CopyChip label={isAr ? "رمز الكاونتر" : "Counter PIN"} value={creds.pin} onCopy={copy} />
      </div>
      <ul className="mt-3 space-y-1">
        {creds.accounts.map((a) => (
          <li key={a.email} className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono text-muted-foreground" dir="ltr">
              {a.email}
            </span>
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 font-medium">{a.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyChip({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className={cn(
        "inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-background px-3",
        "transition-colors hover:bg-muted"
      )}
    >
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-medium" dir="ltr">
        {value}
      </span>
      <Copy className="size-3.5 text-muted-foreground" aria-hidden />
    </button>
  );
}
