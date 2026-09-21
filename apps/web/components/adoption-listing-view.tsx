"use client";

import { digitsOnly } from "@moraqat/core";
import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Baby,
  Cat as CatIcon,
  CheckCircle2,
  Dog,
  Eye,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { Badge, Button, Dialog, Skeleton, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloEmpty } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { localizeName } from "@/lib/translit";
import { friendlyError } from "@/lib/errors";
import {
  catLifeApi,
  cityLabel,
  countView,
  feeLabel,
  formatCatAge,
  adoptionRequestLabel,
  adoptionStatusLabel,
  type AdoptionListing,
} from "@/lib/cat-life-api";

/**
 * One cat, looking for a home.
 *
 * THE ARGUMENT THIS PAGE MAKES
 * A cat rehomed through Moracat does not start over. The Cat ID, the
 * vaccinations, the weights, the clinic entries — all of it goes with them.
 * That claim is made with the actual numbers from the record (R003: value stays
 * visible; R006: never claim what isn't there), and it is the reason to rehome
 * here rather than on a classifieds app.
 *
 * WHAT IT REFUSES TO SHOW
 * The owner's identity. A first name, and how long they've been a member —
 * that is all. A phone number appears only if they published one AND they
 * accepted you. Everyone else reaches them through an enquiry (R106).
 */
export function AdoptionListingView({ id }: { id: string }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { user, authedFetch } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [askOpen, setAskOpen] = React.useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["adoption-listing", id, user?.id ?? "anon"],
    // Signed-in visitors need their own request state on the page, which the
    // public fetcher can't carry — so an authenticated read when we have one.
    queryFn: () =>
      user
        ? authedFetch<AdoptionListing>(`/adoption/listings/${id}`)
        : catLifeApi.adoptionListing(id),
  });

  React.useEffect(() => {
    if (data) countView("adoption", id);
  }, [data, id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
        <Skeleton className="aspect-[4/3] rounded-3xl sm:aspect-[16/9]" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <IlloEmpty
          name="mouse"
          tone="peach"
          float={false}
          title={isAr ? "ما لقينا هذا الإعلان" : "We couldn't find this listing"}
          body={
            isAr
              ? "يمكن القط لقى بيته وانسحب الإعلان. شوف باقي القطط اللي تنتظر."
              : "They may have found their home and the listing came down. Have a look at the others still waiting."
          }
          action={
            <Link href="/adopt">
              <Button size="sm">{isAr ? "شوف القطط" : "See the cats"}</Button>
            </Link>
          }
          secondary={
            <Button size="sm" variant="ghost" onClick={() => void refetch()}>
              {isAr ? "أعد المحاولة" : "Try again"}
            </Button>
          }
        />
      </div>
    );
  }

  const name = localizeName(data.cat.name, isAr ? "ar" : "en");
  const age = formatCatAge(data.cat.ageMonths, isAr);
  const city = cityLabel(data.city, isAr);
  const settled = data.status === "ADOPTED";
  const myRequest = data.viewer.request;

  const facts = [
    age && { label: isAr ? "العمر" : "Age", value: age },
    data.cat.gender !== "UNKNOWN" && {
      label: isAr ? "الجنس" : "Sex",
      value: data.cat.gender === "MALE" ? (isAr ? "ذكر" : "Male") : isAr ? "أنثى" : "Female",
    },
    data.cat.breed && { label: isAr ? "الفصيلة" : "Breed", value: isAr ? data.cat.breed.ar : data.cat.breed.en },
    data.cat.coatColor && { label: isAr ? "اللون" : "Coat", value: data.cat.coatColor },
    data.cat.isNeutered != null && {
      label: isAr ? "معقّم" : "Neutered",
      value: data.cat.isNeutered ? (isAr ? "نعم" : "Yes") : isAr ? "لا" : "No",
    },
    city && { label: isAr ? "المدينة" : "City", value: [city, data.district].filter(Boolean).join(" · ") },
  ].filter(Boolean) as { label: string; value: string }[];

  const goodWith = [
    { key: "kids", icon: Baby, value: data.goodWith.kids, ar: "الأطفال", en: "Kids" },
    { key: "cats", icon: CatIcon, value: data.goodWith.cats, ar: "القطط", en: "Cats" },
    { key: "dogs", icon: Dog, value: data.goodWith.dogs, ar: "الكلاب", en: "Dogs" },
  ].filter((g) => g.value != null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <Link
        href="/adopt"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {isAr ? "كل القطط" : "All cats"}
      </Link>

      {/* ── The cat ──────────────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card shadow-e1">
        <div className="relative aspect-[4/3] bg-muted sm:aspect-[16/9]">
          <ImgWithFallback
            src={data.cat.photoUrl}
            alt={name}
            className="size-full object-cover"
            fallback={
              <span className="grid size-full place-items-center bg-cream/60">
                <Illo3D name="cat" className="size-40" px={160} priority />
              </span>
            }
          />
          {settled && (
            <div className="absolute inset-0 grid place-items-center bg-foreground/55 backdrop-blur-[2px]">
              <div className="text-center text-background">
                <CheckCircle2 className="mx-auto size-10" aria-hidden />
                <p className="mt-2 font-display text-xl font-bold">
                  {isAr ? `${name} لقى بيته` : `${name} found their home`}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {age && <span>{age}</span>}
                {city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {city}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3.5" aria-hidden />
                  {data.viewCount}
                </span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant={data.status === "AVAILABLE" ? "default" : "secondary"}>
                {adoptionStatusLabel(data.status, isAr)}
              </Badge>
              <span className="text-sm font-semibold">{feeLabel(data.feeSar, isAr)}</span>
            </div>
          </div>

          {/* ── What travels with them — the whole argument, in facts ─────── */}
          {data.cat.catIdNumber && (
            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold">
                    {isAr ? "هويته تنتقل معه" : "Their Cat ID goes with them"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {isAr
                      ? `${name} يحمل هوية مرقط منذ ${new Date(data.cat.registeredAt).getFullYear()}. لو تبنّيته، تنتقل لك الهوية بنفس رقمها وسجله الصحي كامل — ما يبدأ ملفه من الصفر.`
                      : `${name} has held a Moracat Cat ID since ${new Date(data.cat.registeredAt).getFullYear()}. If you adopt them, that ID comes to you with the same number and the whole health record — their file doesn't start over.`}
                  </p>
                  <p className="mt-2 font-mono text-xs text-primary" dir="ltr">
                    {data.cat.catIdNumber}
                  </p>
                  {(data.cat.vaccinationCount > 0 || data.cat.publicSlug) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {data.cat.vaccinationCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Syringe className="size-3.5" aria-hidden />
                          {isAr
                            ? `${data.cat.vaccinationCount} تطعيم مسجّل`
                            : `${data.cat.vaccinationCount} vaccination${data.cat.vaccinationCount === 1 ? "" : "s"} on file`}
                        </span>
                      )}
                      {data.cat.publicSlug && (
                        <Link
                          href={`/community/${data.cat.publicSlug}`}
                          className="underline underline-offset-4 transition-colors hover:text-foreground"
                        >
                          {isAr ? "ملفه في المجتمع" : "Their community profile"}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── The owner's own words ────────────────────────────────────── */}
          <section className="mt-6">
            <h2 className="font-display text-base font-semibold">{isAr ? `عن ${name}` : `About ${name}`}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{data.story}</p>
            {data.reason && (
              <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{isAr ? "سبب البحث عن بيت: " : "Why they're being rehomed: "}</span>
                {data.reason}
              </p>
            )}
          </section>

          {facts.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label} className="rounded-2xl border border-border bg-background p-3">
                  <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {goodWith.length > 0 && (
            <div className="mt-5">
              <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                {isAr ? "ينسجم مع" : "Gets on with"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {goodWith.map((g) => (
                  <span
                    key={g.key}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                      g.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground line-through"
                    )}
                  >
                    <g.icon className="size-3.5" aria-hidden />
                    {isAr ? g.ar : g.en}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.cat.photos.length > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {data.cat.photos.map((p) => (
                <ImgWithFallback
                  key={p.id}
                  src={p.url}
                  alt={name}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover"
                  fallback={<span className="block aspect-square w-full rounded-xl bg-muted" />}
                />
              ))}
            </div>
          )}

          {/* ── Who is rehoming — a person, not a profile ─────────────────── */}
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Heart className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {data.owner.name
                  ? isAr
                    ? `${data.owner.name} يدوّر لـ${name} بيتاً`
                    : `${data.owner.name} is looking for a home for ${name}`
                  : isAr
                    ? `أحد أعضاء مرقط يدوّر لـ${name} بيتاً`
                    : `A Moracat member is looking for a home for ${name}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? `عضو منذ ${new Date(data.owner.memberSince).getFullYear()}`
                  : `Member since ${new Date(data.owner.memberSince).getFullYear()}`}
              </p>
            </div>
          </div>

          {/* ── The one action ───────────────────────────────────────────── */}
          <div className="mt-6">
            {data.viewer.isOwner ? (
              <Link href="/portal/adoption">
                <Button className="w-full sm:w-auto">{isAr ? "أدر إعلانك" : "Manage your listing"}</Button>
              </Link>
            ) : settled ? (
              <div className="rounded-2xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">
                {isAr ? "هذا القط لقى بيته 🎉" : "This cat found their home 🎉"}{" "}
                <Link href="/adopt" className="font-medium text-primary underline underline-offset-4">
                  {isAr ? "شوف القطط اللي تنتظر" : "See the cats still waiting"}
                </Link>
              </div>
            ) : myRequest ? (
              <RequestState
                isAr={isAr}
                name={name}
                status={myRequest.status}
                ownerNote={myRequest.ownerNote}
                contact={data.contact}
                onEdit={() => setAskOpen(true)}
              />
            ) : !user ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={`/login?next=${encodeURIComponent(`/adopt/${id}`)}`} className="sm:w-auto">
                  <Button className="w-full">{isAr ? `سجّل الدخول وتواصل عن ${name}` : `Sign in to ask about ${name}`}</Button>
                </Link>
                <Link href={`/register?next=${encodeURIComponent(`/adopt/${id}`)}`} className="sm:w-auto">
                  <Button variant="outline" className="w-full">{isAr ? "جديد؟ أنشئ حساباً" : "New here? Create an account"}</Button>
                </Link>
                <p className="self-center text-xs text-muted-foreground">
                  {isAr ? "نمرّر رسالتك لصاحب القط بدون ما نكشف بياناتك." : "We pass your message on without revealing your details."}
                </p>
              </div>
            ) : (
              <Button className="w-full sm:w-auto" onClick={() => setAskOpen(true)}>
                <MessageCircle className="size-4" aria-hidden />
                {isAr ? `اسأل عن ${name}` : `Ask about ${name}`}
              </Button>
            )}
          </div>
        </div>
      </div>

      <AskDialog
        open={askOpen}
        onClose={() => setAskOpen(false)}
        listingId={id}
        catName={name}
        isAr={isAr}
        initial={myRequest?.message ?? ""}
        onDone={() => {
          setAskOpen(false);
          toast({
            title: isAr ? "وصلت رسالتك" : "Your message is on its way",
            description: isAr
              ? `أبلغنا صاحب ${name}. بيردّ عليك على راحته.`
              : `We've let ${name}'s owner know. They'll reply in their own time.`,
          });
          void queryClient.invalidateQueries({ queryKey: ["adoption-listing", id] });
          void queryClient.invalidateQueries({ queryKey: ["adoption-mine"] });
        }}
      />
    </div>
  );
}

/** Where my enquiry stands — always an answer, never a silent page. */
function RequestState({
  isAr,
  name,
  status,
  ownerNote,
  contact,
  onEdit,
}: {
  isAr: boolean;
  name: string;
  status: AdoptionListing["viewer"]["request"] extends null ? never : NonNullable<AdoptionListing["viewer"]["request"]>["status"];
  ownerNote: string | null;
  contact: AdoptionListing["contact"];
  onEdit: () => void;
}) {
  const accepted = status === "ACCEPTED" || status === "COMPLETED";
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accepted ? "border-primary/25 bg-primary/5" : "border-border bg-background"
      )}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {accepted && <CheckCircle2 className="size-4 text-primary" aria-hidden />}
        {adoptionRequestLabel(status, isAr)}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {status === "PENDING" &&
          (isAr
            ? `وصلت رسالتك لصاحب ${name}. خلّه يقرّر على راحته — ما في استعجال.`
            : `Your message reached ${name}'s owner. Let them decide in their own time.`)}
        {accepted &&
          (isAr
            ? `وافقوا. اتفقوا على التفاصيل، وبعدها يرسلون لك نقل هوية ${name} — وتنتقل لك مع سجله كاملاً.`
            : `They said yes. Agree the details between you, then they'll send ${name}'s Cat ID transfer — it comes to you with the full record.`)}
        {status === "DECLINED" &&
          (isAr
            ? "اعتذروا هالمرة. في قطط ثانية تنتظر بيتاً."
            : "They said no this time. Other cats are still waiting for a home.")}
        {status === "WITHDRAWN" && (isAr ? "سحبت طلبك." : "You withdrew your enquiry.")}
      </p>
      {ownerNote && (
        <p className="mt-2 rounded-xl bg-muted/70 p-3 text-xs text-foreground/90">“{ownerNote}”</p>
      )}
      {accepted && contact?.phone && (
        <a
          href={
            contact.pref === "WHATSAPP"
              ? `https://wa.me/${digitsOnly(contact.phone)}`
              : `tel:${contact.phone}`
          }
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
          dir="ltr"
        >
          <Phone className="size-4" aria-hidden />
          {contact.phone}
        </a>
      )}
      {status === "PENDING" && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-3 min-h-[44px] text-xs font-medium text-primary underline underline-offset-4"
        >
          {isAr ? "عدّل رسالتك" : "Edit your message"}
        </button>
      )}
    </div>
  );
}

function AskDialog({
  open,
  onClose,
  listingId,
  catName,
  isAr,
  initial,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  listingId: string;
  catName: string;
  isAr: boolean;
  initial: string;
  onDone: () => void;
}) {
  const { authedFetch } = useAuth();
  const [message, setMessage] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  // An unverified email is a recovery, not a wall: hand them the door (R112).
  const [needsVerify, setNeedsVerify] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMessage(initial);
      setError(null);
      setNeedsVerify(false);
    }
  }, [open, initial]);

  const mutation = useMutation({
    mutationFn: () =>
      authedFetch(`/adoption/listings/${listingId}/requests`, {
        method: "POST",
        body: JSON.stringify({ message: message.trim() }),
      }),
    onSuccess: onDone,
    onError: (err) => {
      const friendly = friendlyError(err, isAr);
      setError(friendly.message);
      setNeedsVerify(friendly.code === "EMAIL_NOT_VERIFIED");
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isAr ? `اسأل عن ${catName}` : `Ask about ${catName}`}
      description={
        isAr
          ? "احكِ لهم شوي عن بيتك. الرسالة توصلهم عن طريقنا، ورقمك ما ينكشف أبداً. بريدك يوصل لصاحب القط فقط إذا قبل طلبك — عشان تتفقون على اللقاء."
          : "Tell them a little about the home you're offering. The message reaches them through us and your number is never shared. Your email is passed to the owner only if they accept you — so the two of you can arrange to meet."
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
        className="space-y-3"
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          autoFocus
          maxLength={1200}
          placeholder={
            isAr
              ? "مثلاً: عندي شقة هادية وما عندي حيوانات ثانية، وأقدر أمرّ عليكم نهاية الأسبوع…"
              : "e.g. We have a quiet flat, no other pets, and I could come by at the weekend…"
          }
          className="w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
        />
        <p className="text-xs text-muted-foreground">
          {message.trim().length < 20
            ? isAr
              ? "اكتب سطرين على الأقل — هذا اللي يخليهم يطمّنون."
              : "Write a couple of lines — that's what puts them at ease."
            : `${message.length}/1200`}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}{" "}
            {needsVerify && (
              <Link
                href={`/verify-email?next=${encodeURIComponent(`/adopt/${listingId}`)}`}
                className="font-medium underline underline-offset-2"
              >
                {isAr ? "أكّد بريدك الآن" : "Confirm your email now"}
              </Link>
            )}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {isAr ? "لاحقاً" : "Not now"}
          </Button>
          <Button type="submit" disabled={mutation.isPending || message.trim().length < 20}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {isAr ? "أرسل رسالتي" : "Send my message"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
