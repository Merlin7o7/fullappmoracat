"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Loader2,
  MessageCircle,
  Send,
  Undo2,
  X,
} from "lucide-react";
import { Badge, Button, Card, Skeleton, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloEmpty, IlloHeader } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { AdoptionListingForm } from "@/components/adoption-listing-form";
import { QueryError } from "@/components/query-error";
import { localizeName } from "@/lib/translit";
import { relativeTime } from "@/lib/datetime";
import { friendlyMessage } from "@/lib/errors";
import {
  adoptionRequestLabel,
  adoptionStatusLabel,
  cityLabel,
  feeLabel,
  type AdoptionEnquiry,
  type MyAdoption,
} from "@/lib/cat-life-api";

/**
 * The member's side of adoption: the cats I'm rehoming, the enquiries on them,
 * and the enquiries I've sent about someone else's cat.
 *
 * The order of the page is the order of urgency. Someone waiting for an answer
 * from me comes before a listing that is quietly doing fine, which comes before
 * my own enquiries elsewhere (R005: one clear next action, and it should be the
 * one a person is actually keeping someone waiting on).
 */
export default function PortalAdoptionPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { authedFetch } = useAuth();
  const { cats } = useCats();
  const queryClient = useQueryClient();
  const [creating, setCreating] = React.useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["adoption-mine"],
    queryFn: () => authedFetch<MyAdoption>("/adoption/mine"),
  });

  const activeCats = cats.filter((c) => c.status === "ACTIVE");
  const listedCatIds = new Set(
    (data?.listings ?? [])
      .filter((l) => l.status === "AVAILABLE" || l.status === "RESERVED")
      .map((l) => l.cat.id)
  );
  const listable = activeCats.filter((c) => !listedCatIds.has(c.id));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["adoption-mine"] });
    void queryClient.invalidateQueries({ queryKey: ["adoption"] });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <IlloHeader
        name="heart"
        tone="blush"
        align="start"
        eyebrow={isAr ? "التبني" : "Adoption"}
        title={isAr ? "بيت جديد" : "A new home"}
        body={
          isAr
            ? "لو تدوّر لقطك بيتاً، اعرضه هنا — وتنتقل هويته وسجله الصحي كاملاً لصاحبه الجديد."
            : "If you're looking for a home for a cat, list them here — their Cat ID and full record travel with them."
        }
        actions={
          <>
            {listable.length > 0 && !creating && (
              <Button size="sm" onClick={() => setCreating(true)}>
                {isAr ? "اعرض قطاً" : "List a cat"}
              </Button>
            )}
            <Link href="/adopt">
              <Button size="sm" variant="outline">
                {isAr ? "تصفّح القطط" : "Browse cats"}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Button>
            </Link>
          </>
        }
      />

      {creating && (
        <AdoptionListingForm
          cats={listable}
          isAr={isAr}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => void refetch()} retrying={isFetching} />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      ) : (
        <>
          {/* ── My listings ──────────────────────────────────────────────── */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">
              {isAr ? "قططي المعروضة" : "Cats I'm rehoming"}
            </h2>
            {data && data.listings.length > 0 ? (
              data.listings.map((listing) => (
                <ListingRow key={listing.id} listing={listing} isAr={isAr} onChanged={refresh} />
              ))
            ) : (
              <IlloEmpty
                name="cat"
                tone="cream"
                compact
                float={false}
                title={isAr ? "ما عندك قط معروض" : "You're not rehoming anyone"}
                body={
                  activeCats.length === 0
                    ? isAr
                      ? "أول شي سجّل قطك — وبعدها تقدر تعرضه لو احتجت."
                      : "Register a cat first — then you can list them if you ever need to."
                    : isAr
                      ? "وهذا أفضل شي. لو احتجت يوماً، الباب هنا."
                      : "Which is the best outcome. If you ever need it, the door is here."
                }
                action={
                  activeCats.length === 0 ? (
                    <Link href="/portal/cats/new">
                      <Button size="sm">{isAr ? "سجّل قطك" : "Register a cat"}</Button>
                    </Link>
                  ) : listable.length > 0 && !creating ? (
                    <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                      {isAr ? "اعرض قطاً" : "List a cat"}
                    </Button>
                  ) : undefined
                }
              />
            )}
          </section>

          {/* ── Enquiries I've sent ──────────────────────────────────────── */}
          {data && data.requests.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-lg font-semibold">
                {isAr ? "طلباتي" : "My enquiries"}
              </h2>
              {data.requests.map((r) => (
                <Card key={r.id} className="flex items-center gap-3 p-3">
                  <Link href={`/adopt/${r.listing.id}`} className="shrink-0">
                    <ImgWithFallback
                      src={r.listing.cat.photoUrl}
                      alt={r.listing.cat.name}
                      className="size-14 rounded-xl object-cover"
                      fallback={
                        <span className="grid size-14 place-items-center rounded-xl bg-cream/60">
                          <Illo3D name="cat" className="size-10" px={64} shadow={false} />
                        </span>
                      }
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/adopt/${r.listing.id}`} className="truncate font-display font-semibold hover:underline">
                      {localizeName(r.listing.cat.name, isAr ? "ar" : "en")}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {adoptionRequestLabel(r.status, isAr)} · {relativeTime(r.createdAt, isAr)}
                    </p>
                    {r.ownerNote && <p className="mt-1 truncate text-xs text-foreground/80">“{r.ownerNote}”</p>}
                  </div>
                  <Badge variant={r.status === "ACCEPTED" || r.status === "COMPLETED" ? "default" : "secondary"}>
                    {adoptionRequestLabel(r.status, isAr)}
                  </Badge>
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** One of my listings, with its enquiries folded underneath. */
function ListingRow({
  listing,
  isAr,
  onChanged,
}: {
  listing: MyAdoption["listings"][number];
  isAr: boolean;
  onChanged: () => void;
}) {
  const { authedFetch } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const name = localizeName(listing.cat.name, isAr ? "ar" : "en");
  const city = cityLabel(listing.city, isAr);
  const live = listing.status === "AVAILABLE" || listing.status === "RESERVED";

  const enquiries = useQuery({
    queryKey: ["adoption-enquiries", listing.id],
    queryFn: () => authedFetch<{ items: AdoptionEnquiry[] }>(`/adoption/listings/${listing.id}/requests`),
    enabled: open,
  });

  const withdraw = useMutation({
    mutationFn: () => authedFetch(`/adoption/listings/${listing.id}/withdraw`, { method: "POST" }),
    onSuccess: () => {
      toast({
        title: isAr ? "سحبنا الإعلان" : "Listing withdrawn",
        description: isAr ? `${name} ما عاد معروضاً.` : `${name} is no longer listed.`,
      });
      onChanged();
    },
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Link href={`/adopt/${listing.id}`} className="shrink-0">
          <ImgWithFallback
            src={listing.cat.photoUrl}
            alt={name}
            className="size-16 rounded-xl object-cover"
            fallback={
              <span className="grid size-16 place-items-center rounded-xl bg-cream/60">
                <Illo3D name="cat" className="size-12" px={64} shadow={false} />
              </span>
            }
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/adopt/${listing.id}`} className="truncate font-display font-semibold hover:underline">
              {name}
            </Link>
            <Badge variant={listing.status === "ADOPTED" ? "default" : live ? "secondary" : "outline"}>
              {adoptionStatusLabel(listing.status, isAr)}
            </Badge>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {city && <span>{city}</span>}
            <span>{feeLabel(listing.feeSar, isAr)}</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" aria-hidden />
              {listing.viewCount}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button size="sm" variant={listing.pendingRequests > 0 ? "primary" : "outline"} onClick={() => setOpen((v) => !v)}>
            <MessageCircle className="size-4" aria-hidden />
            {listing.pendingRequests > 0
              ? isAr
                ? `${listing.pendingRequests} بانتظارك`
                : `${listing.pendingRequests} waiting`
              : isAr
                ? "الطلبات"
                : "Enquiries"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-muted/30 p-3">
          {enquiries.isLoading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : (enquiries.data?.items.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {isAr
                ? "ما وصل طلب بعد. خذ وقتك — البيت الصح يجي."
                : "No enquiries yet. Take your time — the right home turns up."}
            </p>
          ) : (
            <ul className="space-y-2">
              {enquiries.data?.items.map((e) => (
                <EnquiryRow
                  key={e.id}
                  enquiry={e}
                  catName={listing.cat.name}
                  isAr={isAr}
                  onChanged={() => {
                    void enquiries.refetch();
                    onChanged();
                  }}
                />
              ))}
            </ul>
          )}

          {live && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => withdraw.mutate()}
                disabled={withdraw.isPending}
              >
                {withdraw.isPending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
                {isAr ? "اسحب الإعلان" : "Withdraw the listing"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * One person asking. Accepting reserves the cat and introduces them; handing
 * the Cat ID over is a separate, deliberate second step — because meeting the
 * adopter comes before giving them the animal.
 */
function EnquiryRow({
  enquiry,
  catName,
  isAr,
  onChanged,
}: {
  enquiry: AdoptionEnquiry;
  catName: string;
  isAr: boolean;
  onChanged: () => void;
}) {
  const { authedFetch } = useAuth();
  const { toast } = useToast();
  const [note, setNote] = React.useState("");
  const [deciding, setDeciding] = React.useState<null | "accept" | "decline" | "handover">(null);
  const [confirmName, setConfirmName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const act = useMutation({
    mutationFn: (kind: "accept" | "decline") =>
      authedFetch(`/adoption/requests/${enquiry.id}/${kind}`, {
        method: "POST",
        body: JSON.stringify(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (_res, kind) => {
      setDeciding(null);
      setNote("");
      toast({
        title: kind === "accept" ? (isAr ? "وافقت" : "Accepted") : isAr ? "أرسلنا ردّك" : "They've been told",
        description:
          kind === "accept"
            ? isAr
              ? `أبلغناهم. بعد ما تتفقون، أرسل لهم هوية ${catName}.`
              : `We've told them. Once you've agreed, send them ${catName}'s Cat ID.`
            : isAr
              ? "ردّ بلطف خير من صمت."
              : "A kind no beats silence.",
      });
      onChanged();
    },
    onError: (err) => setError(friendlyMessage(err, isAr)),
  });

  const handover = useMutation({
    mutationFn: () =>
      authedFetch(`/adoption/requests/${enquiry.id}/handover`, {
        method: "POST",
        body: JSON.stringify({ confirmCatName: confirmName.trim() }),
      }),
    onSuccess: () => {
      setDeciding(null);
      setConfirmName("");
      toast({
        title: isAr ? "أرسلنا نقل الهوية" : "The Cat ID transfer is on its way",
        description: isAr
          ? `${catName} ينتقل لهم أول ما يقبلون.`
          : `${catName} moves the moment they accept.`,
      });
      onChanged();
    },
    onError: (err) => setError(friendlyMessage(err, isAr)),
  });

  const accepted = enquiry.status === "ACCEPTED";
  const done = enquiry.status === "COMPLETED";
  const nameMatches = confirmName.trim().toLocaleLowerCase() === catName.trim().toLocaleLowerCase();

  return (
    <li className="rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {enquiry.requester.name ?? (isAr ? "عضو في مرقط" : "A Moracat member")}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? `عضو منذ ${new Date(enquiry.requester.memberSince).getFullYear()} · ${enquiry.requester.catsRegistered} قط مسجّل · ${relativeTime(enquiry.createdAt, true)}`
              : `Member since ${new Date(enquiry.requester.memberSince).getFullYear()} · ${enquiry.requester.catsRegistered} cat${enquiry.requester.catsRegistered === 1 ? "" : "s"} registered · ${relativeTime(enquiry.createdAt, false)}`}
          </p>
        </div>
        <Badge variant={accepted || done ? "default" : "secondary"}>
          {adoptionRequestLabel(enquiry.status, isAr)}
        </Badge>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{enquiry.message}</p>

      {enquiry.requester.email && (
        <p className="mt-2 font-mono text-xs text-muted-foreground" dir="ltr">
          {enquiry.requester.email}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ── Deciding ──────────────────────────────────────────────────── */}
      {deciding === "handover" ? (
        <div className="mt-3 rounded-xl bg-muted/60 p-3">
          <p className="text-sm">
            {isAr
              ? `بترسل هوية ${catName} وسجله كاملاً لهم. بعد ما يقبلون، ما عاد تقدر توصل لملفه.`
              : `You're sending ${catName}'s Cat ID and whole record to them. Once they accept, you can no longer open their file.`}
          </p>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={isAr ? `اكتب «${catName}»` : `Type “${catName}”`}
            dir="auto"
            className={cn(
              "mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2",
              confirmName && !nameMatches ? "border-destructive" : "border-border"
            )}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={!nameMatches || handover.isPending} onClick={() => handover.mutate()}>
              {handover.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {isAr ? "أرسل الهوية" : "Send the Cat ID"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeciding(null)}>
              {isAr ? "تراجع" : "Cancel"}
            </Button>
          </div>
        </div>
      ) : deciding ? (
        <div className="mt-3 rounded-xl bg-muted/60 p-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={
              deciding === "accept"
                ? isAr
                  ? "كلمة لهم (اختياري) — متى تقدرون تلتقون؟"
                  : "A word to them (optional) — when could you meet?"
                : isAr
                  ? "كلمة لطيفة (اختياري)"
                  : "A kind word (optional)"
            }
            className="w-full rounded-xl border border-border bg-background p-2.5 text-sm outline-none ring-primary/20 transition focus:ring-2"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={act.isPending} onClick={() => act.mutate(deciding)}>
              {act.isPending && <Loader2 className="size-4 animate-spin" />}
              {deciding === "accept" ? (isAr ? "وافق" : "Accept") : isAr ? "اعتذر" : "Decline"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeciding(null)}>
              {isAr ? "تراجع" : "Cancel"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {accepted && (
            <Button size="sm" onClick={() => setDeciding("handover")}>
              <Send className="size-4" aria-hidden />
              {isAr ? "أرسل هوية القط" : "Send the Cat ID"}
            </Button>
          )}
          {done && (
            <span className="inline-flex items-center gap-1.5 text-sm text-primary">
              <CheckCircle2 className="size-4" aria-hidden />
              {isAr ? "اكتمل التبني" : "Adoption complete"}
            </span>
          )}
          {enquiry.status === "PENDING" && (
            <>
              <Button size="sm" onClick={() => setDeciding("accept")}>
                {isAr ? "وافق" : "Accept"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeciding("decline")}>
                <X className="size-4" aria-hidden />
                {isAr ? "اعتذر" : "Decline"}
              </Button>
            </>
          )}
          {accepted && (
            <Button size="sm" variant="ghost" onClick={() => setDeciding("decline")}>
              {isAr ? "تراجع عن الموافقة" : "Change my mind"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
