"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  Eye,
  Home,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { Badge, Button, Dialog, Skeleton, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloEmpty } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { localizeName } from "@/lib/translit";
import { relativeTime, formatDate } from "@/lib/datetime";
import { friendlyMessage } from "@/lib/errors";
import { fetchWithTimeout, httpError } from "@/lib/http";
import { catLifeApi, cityLabel, countView, lostFoundStatusLabel, type LostFoundPost } from "@/lib/cat-life-api";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/**
 * One lost or found cat.
 *
 * THE ONE JOB: get a message from whoever is looking at this page to whoever
 * filed it, in as few steps as possible. A neighbour standing in a car park
 * holding a cat is not going to create an account first, so the relay is open
 * to signed-out visitors — the reunion outranks the funnel.
 *
 * WHAT STAYS PRIVATE: the reporter, unless they chose otherwise. A phone number
 * appears only because they published one. The microchip number shows as "on
 * file" to everyone and in full only to the person who wrote it down, because a
 * chip number is a key to a cat's identity (R106).
 */
export function LostFoundView({ id }: { id: string }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { user, authedFetch } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [relayOpen, setRelayOpen] = React.useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["lost-found-post", id, user?.id ?? "anon"],
    queryFn: () =>
      user ? authedFetch<LostFoundPost>(`/lost-found/posts/${id}`) : catLifeApi.lostFoundPost(id),
  });

  React.useEffect(() => {
    if (data) countView("lost-found", id);
  }, [data, id]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="aspect-[4/3] rounded-3xl" />
        <Skeleton className="h-8 w-40" />
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
          title={isAr ? "ما لقينا هذا الإعلان" : "We couldn't find this notice"}
          body={isAr ? "يمكن رجع القط لأهله وأُغلق الإعلان." : "The cat may be home and the notice closed."}
          action={
            <Link href="/lost-found">
              <Button size="sm">{isAr ? "افتح اللوحة" : "Open the board"}</Button>
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

  const name = data.catName ? localizeName(data.catName, isAr ? "ar" : "en") : null;
  const lost = data.kind === "LOST";
  const home = data.status === "REUNITED";
  const city = cityLabel(data.city, isAr);
  const where = [city, data.district, data.areaNote].filter(Boolean).join(" · ");
  const closed = data.status !== "ACTIVE";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Link
        href="/lost-found"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {isAr ? "اللوحة" : "The board"}
      </Link>

      <article
        className={cn(
          "mt-4 overflow-hidden rounded-3xl border bg-card shadow-e1",
          home ? "border-primary/30" : lost ? "border-destructive/25" : "border-border"
        )}
      >
        <div className="relative aspect-[4/3] bg-muted sm:aspect-[16/9]">
          <ImgWithFallback
            src={data.photoUrl}
            alt={name ?? (isAr ? "قط" : "A cat")}
            className="size-full object-cover"
            fallback={
              <span className="grid size-full place-items-center bg-cream/60">
                <Illo3D name="cat" className="size-36" px={144} priority />
              </span>
            }
          />
          {home && (
            <div className="absolute inset-0 grid place-items-center bg-primary/70 backdrop-blur-[2px]">
              <div className="text-center text-primary-foreground">
                <Home className="mx-auto size-10" aria-hidden />
                <p className="mt-2 font-display text-xl font-bold">
                  {name ? (isAr ? `${name} رجع لأهله` : `${name} is home`) : isAr ? "رجع لأهله" : "Back home"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {name ?? (isAr ? "قط بدون اسم" : "An unnamed cat")}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {lost
                    ? isAr
                      ? `فُقد ${relativeTime(data.happenedAt, isAr)}`
                      : `Lost ${relativeTime(data.happenedAt, isAr)}`
                    : isAr
                      ? `وُجد ${relativeTime(data.happenedAt, isAr)}`
                      : `Found ${relativeTime(data.happenedAt, isAr)}`}
                  <span className="opacity-70">({formatDate(data.happenedAt, isAr ? "ar" : "en")})</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3.5" aria-hidden />
                  {data.viewCount}
                </span>
              </p>
            </div>
            <Badge variant={home ? "default" : lost ? "destructive" : "secondary"}>
              {lostFoundStatusLabel(data.kind, data.status, isAr)}
            </Badge>
          </div>

          {where && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-muted/60 p-3 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="font-medium">{lost ? (isAr ? "آخر مكان شوفوه فيه" : "Last seen") : isAr ? "مكان العثور" : "Found near"}: </span>
                {where}
              </span>
            </p>
          )}

          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{data.description}</p>

          {/* ── Identifying marks ────────────────────────────────────────── */}
          <div className="mt-5 flex flex-wrap gap-2">
            {data.gender !== "UNKNOWN" && (
              <Mark label={isAr ? "الجنس" : "Sex"} value={data.gender === "MALE" ? (isAr ? "ذكر" : "Male") : isAr ? "أنثى" : "Female"} />
            )}
            {data.colorNote && <Mark label={isAr ? "اللون" : "Colour"} value={data.colorNote} />}
            {data.hasCollar != null && (
              <Mark
                label={isAr ? "طوق" : "Collar"}
                value={data.hasCollar ? (isAr ? "عليه طوق" : "Wearing one") : isAr ? "بدون طوق" : "None"}
              />
            )}
            {data.microchip && (
              <Mark
                icon={Tag}
                label={isAr ? "شريحة" : "Microchip"}
                // Everyone learns a chip exists; only the reporter sees it.
                value={data.microchip.value ?? (isAr ? "مسجّلة" : "On file")}
              />
            )}
          </div>

          {/* The Cat ID behind a registered cat — the badge that separates this
              from a notice board (R040). */}
          {data.registeredCat && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 text-sm">
                <p className="font-display font-semibold">{isAr ? "قط مسجّل في مرقط" : "A registered Moracat cat"}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {isAr
                    ? "له هوية رسمية وسجل صحي. لو لقيته، امسح الرمز على طوقه أو راسل صاحبه من هنا."
                    : "They hold an official Cat ID and a health record. If you've found them, scan the tag on their collar or message the owner here."}
                </p>
                {data.registeredCat.catIdNumber && (
                  <p className="mt-1.5 font-mono text-xs text-primary" dir="ltr">
                    {data.registeredCat.catIdNumber}
                  </p>
                )}
                {data.registeredCat.publicSlug && (
                  <Link
                    href={`/community/${data.registeredCat.publicSlug}`}
                    className="mt-1 inline-block text-xs underline underline-offset-4"
                  >
                    {isAr ? "ملفه في المجتمع" : "Their community profile"}
                  </Link>
                )}
              </div>
            </div>
          )}

          {data.photos.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {data.photos.map((url) => (
                <ImgWithFallback
                  key={url}
                  src={url}
                  alt={name ?? ""}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover"
                  fallback={<span className="block aspect-square w-full rounded-xl bg-muted" />}
                />
              ))}
            </div>
          )}

          {/* ── Reaching them ────────────────────────────────────────────── */}
          <div className="mt-6">
            {data.viewer.isReporter ? (
              <Link href="/portal/lost-found">
                <Button className="w-full sm:w-auto">{isAr ? "أدر إعلانك" : "Manage your notice"}</Button>
              </Link>
            ) : closed ? (
              <p className="rounded-2xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">
                {home
                  ? isAr
                    ? "هذا القط رجع لأهله 🎉"
                    : "This cat made it home 🎉"
                  : isAr
                    ? "هذا الإعلان مغلق."
                    : "This notice is closed."}
              </p>
            ) : (
              <div className="space-y-3">
                <Button className="w-full sm:w-auto" onClick={() => setRelayOpen(true)}>
                  <MessageCircle className="size-4" aria-hidden />
                  {lost
                    ? isAr
                      ? "شفت هذا القط"
                      : "I've seen this cat"
                    : isAr
                      ? "أظن هذا قطي"
                      : "I think this is my cat"}
                </Button>
                {/* A published number is a deliberate choice by the reporter —
                    when it exists, it is the fastest route and gets its own
                    button rather than being buried in the relay. */}
                {data.contact.phone && (
                  <a
                    href={
                      data.contact.pref === "WHATSAPP"
                        ? `https://wa.me/${data.contact.phone.replace(/\D/g, "")}`
                        : `tel:${data.contact.phone}`
                    }
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
                    dir="ltr"
                  >
                    <Phone className="size-4" aria-hidden />
                    {data.contact.phone}
                  </a>
                )}
                {data.contact.pref === "EMAIL" && data.contact.email && (
                  <a
                    href={`mailto:${data.contact.email}`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
                    dir="ltr"
                  >
                    <Mail className="size-4" aria-hidden />
                    {data.contact.email}
                  </a>
                )}
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "رسالتك توصلهم عن طريق مرقط. ما نكشف بياناتهم، ولا نكشف بياناتك إلا اللي تكتبه بنفسك."
                    : "Your message reaches them through Moracat. We don't reveal their details — or yours, beyond what you choose to write."}
                </p>
              </div>
            )}
          </div>
        </div>
      </article>

      <RelayDialog
        open={relayOpen}
        onClose={() => setRelayOpen(false)}
        postId={id}
        isAr={isAr}
        lost={lost}
        catName={name}
        onDone={() => {
          setRelayOpen(false);
          toast({
            title: isAr ? "وصلت رسالتك" : "Your message is on its way",
            description: isAr
              ? "أبلغنا صاحب الإعلان على طول. شكراً لك 🤍"
              : "We've told them right away. Thank you 🤍",
          });
          void queryClient.invalidateQueries({ queryKey: ["lost-found-post", id] });
        }}
      />
    </div>
  );
}

function Mark({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs">
      {Icon && <Icon className="size-3.5 text-muted-foreground" aria-hidden />}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium" dir="auto">
        {value}
      </span>
    </span>
  );
}

/**
 * The relay. Signed-out visitors post to the same endpoint (it is
 * `@OptionalAuth`), so the form never asks anyone to make an account before
 * helping a cat get home.
 */
function RelayDialog({
  open,
  onClose,
  postId,
  isAr,
  lost,
  catName,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  isAr: boolean;
  lost: boolean;
  catName: string | null;
  onDone: () => void;
}) {
  const { user, authedFetch } = useAuth();
  const [message, setMessage] = React.useState("");
  const [senderName, setSenderName] = React.useState("");
  const [senderPhone, setSenderPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setMessage("");
      setError(null);
      setSenderName(user?.firstName ?? "");
    }
  }, [open, user]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify({
        message: message.trim(),
        ...(senderName.trim() ? { senderName: senderName.trim() } : {}),
        ...(senderPhone.trim() ? { senderPhone: senderPhone.trim() } : {}),
      });
      if (user) {
        return authedFetch(`/lost-found/posts/${postId}/messages`, { method: "POST", body });
      }
      // Anonymous path — a neighbour with a cat in their arms, not a member.
      const res = await fetchWithTimeout(`${BASE}/api/lost-found/posts/${postId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body,
      });
      if (!res.ok) throw httpError(res.status, await res.json().catch(() => null), "Message failed");
      return res.json();
    },
    onSuccess: onDone,
    onError: (err) => setError(friendlyMessage(err, isAr)),
  });

  const who = catName ?? (isAr ? "هذا القط" : "this cat");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={lost ? (isAr ? `شفت ${who}؟` : `Seen ${who}?`) : isAr ? "أظن هذا قطي" : "I think this is my cat"}
      description={
        lost
          ? isAr
            ? "أي تفصيل يساعد — وين وامتى، ولو صورة ما عندك. رسالتك توصل صاحبه على طول."
            : "Any detail helps — where and when. Your message reaches the owner straight away."
          : isAr
            ? "اكتب أي شي يثبت إنه قطك — علامة مميزة، رقم شريحة، أو صورة عندك."
            : "Write anything that identifies them — a distinctive marking, a chip number, a photo you have."
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
          rows={5}
          autoFocus
          maxLength={1000}
          placeholder={
            lost
              ? isAr
                ? "مثلاً: شفت قط يشبهه عند مسجد الحي أمس بعد المغرب…"
                : "e.g. I saw a cat like this by the mosque on King Fahd yesterday evening…"
              : isAr
                ? "مثلاً: عنده بقعة بيضاء تحت الذقن، وضاع مني قبل ثلاثة أيام…"
                : "e.g. He has a white patch under his chin, and went missing three days ago…"
          }
          className="w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-foreground/80">
              {isAr ? "اسمك (اختياري)" : "Your name (optional)"}
            </span>
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              maxLength={60}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-foreground/80">
              {isAr ? "رقمك (اختياري)" : "Your number (optional)"}
            </span>
            <input
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              inputMode="tel"
              dir="ltr"
              maxLength={20}
              placeholder="05X XXX XXXX"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {isAr
            ? "رقمك يوصلهم عشان يردّون عليك — ما ينشر في الصفحة."
            : "Your number goes to them so they can call you back — it's never published on the page."}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="submit" disabled={mutation.isPending || message.trim().length < 5}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {isAr ? "أرسل" : "Send"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
