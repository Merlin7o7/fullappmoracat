"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Camera,
  FileHeart,
  Loader2,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { Button, Skeleton, cn, useToast } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloEmpty } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { localizeName } from "@/lib/translit";
import { formatDate } from "@/lib/datetime";
import { friendlyMessage } from "@/lib/errors";
import { catLifeApi, formatCatAge, transferStatusLabel, type TransferPreview } from "@/lib/cat-life-api";

/**
 * "Someone is handing you their cat."
 *
 * This is the second of the two confirmations that guard a Cat ID (the first is
 * the outgoing owner typing the cat's name). It is deliberately a whole page,
 * not a dialog: accepting means a real animal and a real medical record become
 * your responsibility, and that deserves to be read, not dismissed.
 *
 * It is readable signed out — the recipient may not have an account yet — and
 * it discloses nothing about the household offering the cat beyond a first
 * name, because someone with a guessed token must learn nothing.
 *
 * The page's honest centre is the inheritance list: the vaccinations, clinic
 * entries and photos that come with the cat, counted from the actual record
 * (R003, R006).
 */
export default function TransferPage({ params }: { params: { token: string } }) {
  const token = params.token;
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { user, authedFetch, ready } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["transfer-preview", token, user?.id ?? "anon"],
    // `token` is usually the emailed capability, which reads anonymously. It is
    // also allowed to be the transfer's own id — that is how the portal links
    // here when a member deleted the email — and an id only resolves for the
    // person the offer is addressed to, through the authenticated route.
    queryFn: async () => {
      try {
        return await catLifeApi.transferPreview(token);
      } catch (err) {
        if (!user) throw err;
        return authedFetch<TransferPreview>(`/transfers/${token}`);
      }
    },
    enabled: ready,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () =>
      authedFetch<{ catId: string; catName: string }>("/transfers/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    onSuccess: (res) => {
      toast({
        title: isAr ? `${res.catName} صار لك 🎉` : `${res.catName} is yours 🎉`,
        description: isAr
          ? "هويته وسجله الصحي انتقلوا لك كاملين."
          : "Their Cat ID and full health record came with them.",
      });
      // /portal/cats?cat=<id> is the deep-link convention (there is no
      // /portal/cats/<id> page — only /health and /privacy live under it), and
      // it opens the roster focused on the cat that just arrived.
      router.push(`/portal/cats?cat=${res.catId}`);
    },
    onError: (err) => setError(friendlyMessage(err, isAr)),
  });

  const decline = useMutation({
    mutationFn: () =>
      authedFetch("/transfers/decline", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: () => {
      toast({
        title: isAr ? "اعتذرت عن الاستلام" : "You declined",
        description: isAr ? "القط باقٍ عند صاحبه، وما تغيّر شي." : "The cat stays where they are — nothing changed.",
      });
      void refetch();
    },
    onError: (err) => setError(friendlyMessage(err, isAr)),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-3xl" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : isError || !data ? (
            <IlloEmpty
              name="mouse"
              tone="peach"
              float={false}
              title={isAr ? "هذا الرابط ما عاد يشتغل" : "This link no longer works"}
              body={
                isAr
                  ? "يمكن انتهت صلاحيته، أو سحبه صاحب القط، أو قُبل من قبل. اطلب رابطاً جديداً من الشخص اللي أرسله لك."
                  : "It may have expired, been withdrawn, or already been accepted. Ask whoever sent it for a fresh one."
              }
              action={
                <Link href="/">
                  <Button size="sm">{isAr ? "الصفحة الرئيسية" : "Go home"}</Button>
                </Link>
              }
            />
          ) : data.status !== "PENDING" ? (
            <SettledState status={data.status} isAr={isAr} catName={data.cat.name} />
          ) : (
            <>
              {/* ── The cat ───────────────────────────────────────────── */}
              <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-e1">
                <div className="relative aspect-[16/9] bg-muted">
                  <ImgWithFallback
                    src={data.cat.photoUrl}
                    alt={localizeName(data.cat.name, isAr ? "ar" : "en")}
                    className="size-full object-cover"
                    fallback={
                      <span className="grid size-full place-items-center bg-cream/60">
                        <Illo3D name="cat" className="size-36" px={144} priority />
                      </span>
                    }
                  />
                </div>
                <div className="p-6 sm:p-8">
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {isAr ? "نقل ملكية" : "A hand-over"}
                  </p>
                  <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                    {data.fromName
                      ? isAr
                        ? `${data.fromName} يسلّمك ${localizeName(data.cat.name, "ar")}`
                        : `${data.fromName} is handing you ${data.cat.name}`
                      : isAr
                        ? `${localizeName(data.cat.name, "ar")} بانتظارك`
                        : `${data.cat.name} is waiting for you`}
                  </h1>

                  <dl className="mt-4 flex flex-wrap gap-2 text-xs">
                    {data.cat.catIdNumber && (
                      <Fact label={isAr ? "رقم الهوية" : "Cat ID"} value={data.cat.catIdNumber} mono />
                    )}
                    {formatCatAge(monthsBetween(data.cat.birthDate), isAr) && (
                      <Fact label={isAr ? "العمر" : "Age"} value={formatCatAge(monthsBetween(data.cat.birthDate), isAr)!} />
                    )}
                    {data.cat.breed && (
                      <Fact label={isAr ? "الفصيلة" : "Breed"} value={isAr ? data.cat.breed.ar : data.cat.breed.en} />
                    )}
                  </dl>

                  {data.note && (
                    <blockquote className="mt-5 rounded-2xl border-s-[3px] border-primary bg-muted/60 p-4 text-sm leading-relaxed">
                      “{data.note}”
                    </blockquote>
                  )}

                  {/* ── What you inherit — the honest centre of the page ── */}
                  <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="font-display text-sm font-semibold">
                      {isAr ? "اللي ينتقل لك معه" : "What comes with them"}
                    </p>
                    <ul className="mt-3 space-y-2 text-sm">
                      <Inherit
                        icon={FileHeart}
                        text={
                          isAr
                            ? `هويته بنفس الرقم — ${data.cat.catIdNumber ?? "هوية مرقط"} — ما تتغيّر`
                            : `Their Cat ID, same number — ${data.cat.catIdNumber ?? "their Moracat ID"} — unchanged`
                        }
                      />
                      <Inherit
                        icon={Syringe}
                        text={
                          isAr
                            ? `${data.cat.history.vaccinations} تطعيم مسجّل`
                            : `${data.cat.history.vaccinations} vaccination${data.cat.history.vaccinations === 1 ? "" : "s"} on file`
                        }
                      />
                      <Inherit
                        icon={Stethoscope}
                        text={
                          isAr
                            ? `${data.cat.history.clinicalEntries} سجلاً من العيادات`
                            : `${data.cat.history.clinicalEntries} clinic record${data.cat.history.clinicalEntries === 1 ? "" : "s"}`
                        }
                      />
                      <Inherit
                        icon={Camera}
                        text={
                          isAr
                            ? `${data.cat.history.photos} صورة في ألبومه`
                            : `${data.cat.history.photos} photo${data.cat.history.photos === 1 ? "" : "s"} in their album`
                        }
                      />
                    </ul>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {isAr
                        ? "وصول العيادات لسجله يتوقف تلقائياً عند النقل — أنت اللي تقرّر مين يشوفه بعدها."
                        : "Clinic access to the record is revoked automatically on transfer — who sees it next is your call alone."}
                    </p>
                  </section>

                  {/* ── The decision ─────────────────────────────────────── */}
                  <div className="mt-6">
                    {!ready ? (
                      <Skeleton className="h-11 w-full rounded-full" />
                    ) : !user ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {isAr
                            ? `هذا العرض موجّه إلى ${data.toEmailMasked}. سجّل الدخول بنفس البريد — أو أنشئ حساباً فيه — عشان تقبل.`
                            : `This offer is addressed to ${data.toEmailMasked}. Sign in with that address — or create an account with it — to accept.`}
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Link href={`/login?next=${encodeURIComponent(`/transfer/${token}`)}`}>
                            <Button className="w-full sm:w-auto">{isAr ? "تسجيل الدخول" : "Sign in"}</Button>
                          </Link>
                          <Link href={`/register?next=${encodeURIComponent(`/transfer/${token}`)}`}>
                            <Button variant="outline" className="w-full sm:w-auto">
                              {isAr ? "أنشئ حساباً" : "Create an account"}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ) : confirming ? (
                      <div className="rounded-2xl border border-border bg-background p-4">
                        <p className="text-sm font-medium">
                          {isAr
                            ? `متأكد إنك تبي تستلم ${localizeName(data.cat.name, "ar")}؟`
                            : `Take responsibility for ${data.cat.name}?`}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {isAr
                            ? "بعد القبول، تصير هويته وسجله تحت حسابك، وصاحبه السابق ما عاد يقدر يوصل لهم."
                            : "Once you accept, their Cat ID and record sit under your account, and the previous owner loses access to them."}
                        </p>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <Button onClick={() => accept.mutate()} disabled={accept.isPending}>
                            {accept.isPending && <Loader2 className="size-4 animate-spin" />}
                            {isAr ? "نعم، أستلمه" : "Yes, they're mine now"}
                          </Button>
                          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={accept.isPending}>
                            {isAr ? "رجوع" : "Back"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button size="lg" onClick={() => setConfirming(true)}>
                          {isAr ? `استلم ${localizeName(data.cat.name, "ar")}` : `Accept ${data.cat.name}`}
                        </Button>
                        <Button
                          size="lg"
                          variant="ghost"
                          onClick={() => decline.mutate()}
                          disabled={decline.isPending}
                        >
                          {decline.isPending && <Loader2 className="size-4 animate-spin" />}
                          {isAr ? "أعتذر" : "Decline"}
                        </Button>
                      </div>
                    )}
                    {error && (
                      <p role="alert" className="mt-3 text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    <p className="mt-4 text-xs text-muted-foreground">
                      {isAr
                        ? `الرابط صالح حتى ${formatDate(data.expiresAt, "ar")}. لا يصير شي إلا لما تختار بنفسك.`
                        : `This link is valid until ${formatDate(data.expiresAt, "en")}. Nothing happens until you choose.`}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("font-medium", mono && "font-mono")} dir={mono ? "ltr" : "auto"}>
        {value}
      </span>
    </span>
  );
}

function Inherit({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span>{text}</span>
    </li>
  );
}

/** A transfer that is already over — say which ending it had, and move on. */
function SettledState({
  status,
  isAr,
  catName,
}: {
  status: string;
  isAr: boolean;
  catName: string;
}) {
  const accepted = status === "ACCEPTED";
  return (
    <IlloEmpty
      name={accepted ? "heart" : "cat"}
      tone={accepted ? "blush" : "cream"}
      float={false}
      title={
        accepted
          ? isAr
            ? `${catName} انتقل بالفعل`
            : `${catName} has already moved`
          : transferStatusLabel(status as never, isAr)
      }
      body={
        accepted
          ? isAr
            ? "تم قبول هذا النقل من قبل. لو كنت أنت من استلمه، بتلقاه في قططك."
            : "This hand-over was already accepted. If it was you who accepted it, they're in your cats."
          : isAr
            ? "ما عاد هذا العرض قائماً. اطلب رابطاً جديداً لو لسّا تبي تستلم القط."
            : "This offer is no longer open. Ask for a fresh link if you still want to take them in."
      }
      action={
        <Link href="/portal/cats">
          <Button size="sm">{isAr ? "قططي" : "My cats"}</Button>
        </Link>
      }
    />
  );
}

/** Whole months from a birth date, or null when nobody ever knew it. */
function monthsBetween(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  const months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  return months >= 0 ? months : null;
}
