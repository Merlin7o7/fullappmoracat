"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { AuthShell } from "@/components/auth-shell";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyEmailInner />
    </React.Suspense>
  );
}

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const isChange = params.get("mode") === "change";
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const [state, setState] = React.useState<"loading" | "done" | "error">(
    token ? "loading" : "error"
  );

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE}/api/auth/email/verify`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!cancelled) setState(res.ok ? "done" : "error");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <AuthShell
        isAr={isAr}
        title={isAr ? "جارٍ التأكيد…" : "Confirming…"}
        subtitle={isAr ? "لحظة من فضلك" : "One moment please"}
      >
        <div className="grid place-items-center py-6 text-muted-foreground">
          <Loader2 className="size-10 animate-spin" />
        </div>
      </AuthShell>
    );
  }

  if (state === "done") {
    return (
      <AuthShell
        isAr={isAr}
        title={
          isChange
            ? isAr
              ? "تم تحديث بريدك"
              : "Email updated"
            : isAr
              ? "تم تأكيد بريدك"
              : "Email confirmed"
        }
        subtitle={
          isChange
            ? isAr
              ? "أصبح بريدك الجديد فعّالاً."
              : "Your new email is now active."
            : isAr
              ? "شكراً لك — حسابك الآن مؤكَّد."
              : "Thank you — your account is now verified."
        }
      >
        <div className="grid place-items-center py-4 text-success">
          <CheckCircle2 className="size-12" />
        </div>
        <Link href="/portal">
          <Button size="lg" className="w-full">
            {isAr ? "الذهاب إلى حسابي" : "Go to my account"}
          </Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      isAr={isAr}
      title={isAr ? "رابط غير صالح" : "Link not valid"}
      subtitle={
        isAr
          ? "رابط التأكيد ناقص أو منتهي الصلاحية. يمكنك طلب رابط جديد من إعدادات حسابك."
          : "This confirmation link is missing or expired. You can request a new one from your account settings."
      }
    >
      <div className="grid place-items-center py-4 text-destructive">
        <XCircle className="size-12" />
      </div>
      <Link href="/portal/settings">
        <Button size="lg" variant="outline" className="w-full">
          {isAr ? "إعدادات الحساب" : "Account settings"}
        </Button>
      </Link>
    </AuthShell>
  );
}
