"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Lock, Copy, ExternalLink, Check, Users } from "lucide-react";
import { Button, Dialog, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";

interface Visibility {
  isPublic: boolean;
  publicSlug: string | null;
  bio: string | null;
  /** The owner's public display name (lives on the account, one across all cats). */
  ownerNickname: string | null;
  showOwnerName: boolean;
  showCity: boolean;
  showGallery: boolean;
  showAge: boolean;
  showBreed: boolean;
  viewCount: number;
  /** PDPL photo-consent attestation (R106); null = never attested. */
  shareConsentAt: string | null;
}

/**
 * Community sharing + per-field privacy. Private by default. Turning "share"
 * on reveals granular controls — the owner decides exactly what a public visitor
 * sees. Nothing is public until they opt in (R: privacy is robust).
 */
export function CatCommunityPanel({ catId, catName, isAr }: { catId: string; catName: string; isAr: boolean }) {
  const { authedFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const { data: v, isLoading } = useQuery({
    queryKey: ["visibility", catId],
    queryFn: () => authedFetch<Visibility>(`/cats/${catId}/visibility`),
  });

  const patch = useMutation({
    mutationFn: (body: Partial<Visibility> & { consent?: boolean }) =>
      authedFetch<Visibility>(`/cats/${catId}/visibility`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (next) => qc.setQueryData(["visibility", catId], next),
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });

  // PDPL photo-consent attestation (R106): asked exactly once, the first time
  // the profile goes public. After that the stored `shareConsentAt` stands.
  const [consentOpen, setConsentOpen] = React.useState(false);
  const [consentChecked, setConsentChecked] = React.useState(false);

  const [bio, setBio] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (v && bio === null) setBio(v.bio ?? "");
  }, [v, bio]);

  // The owner's public display name — the "how do I appear with them?" choice
  // from the ceremony (D6), editable here anytime, as promised there.
  const [nick, setNick] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (v && nick === null) setNick(v.ownerNickname ?? "");
  }, [v, nick]);

  if (isLoading || !v) {
    return <div className="h-24 animate-pulse rounded-2xl bg-muted/50" />;
  }

  const publicUrl =
    v.publicSlug && typeof window !== "undefined" ? `${window.location.origin}/community/${v.publicSlug}` : null;

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast({ title: isAr ? "تم نسخ الرابط" : "Link copied", variant: "success" });
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      {/* Share switch */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="size-4 text-primary" />
            {isAr ? "المشاركة في المجتمع" : "Share with the community"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {v.isPublic
              ? isAr
                ? "هوية قطك ظاهرة للعامة."
                : "Your cat's profile is public."
              : isAr
                ? `شارك ${catName} مع مجتمع مرقط؟ يبقى خاصاً حتى تختار.`
                : `Share ${catName} with the Moracat community? Private until you choose.`}
          </p>
        </div>
        <Switch
          on={v.isPublic}
          onLabel={isAr ? "عام" : "Public"}
          offLabel={isAr ? "خاص" : "Private"}
          onIcon={Globe}
          offIcon={Lock}
          disabled={patch.isPending}
          onChange={(on) => {
            // Going public shows photos to the world — attest photo consent once
            // (PDPL, R106) before the toggle commits. Turning off never asks.
            if (on && !v.shareConsentAt) {
              setConsentChecked(false);
              setConsentOpen(true);
              return;
            }
            patch.mutate({ isPublic: on });
          }}
        />
      </div>

      <Dialog
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        title={isAr ? `قبل ما يصير ملف ${catName} عاماً` : `Before ${catName}'s profile goes public`}
        description={
          isAr
            ? "خطوة وحدة صغيرة تحفظ خصوصية الجميع."
            : "One small step that protects everyone's privacy."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConsentOpen(false)} disabled={patch.isPending}>
              {isAr ? "ليس الآن" : "Not now"}
            </Button>
            <Button
              disabled={!consentChecked}
              loading={patch.isPending}
              onClick={() =>
                patch.mutate(
                  { isPublic: true, consent: true },
                  { onSuccess: () => setConsentOpen(false) }
                )
              }
            >
              {isAr ? `شارك ${catName} مع المجتمع` : `Share ${catName} with the community`}
            </Button>
          </>
        }
      >
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            {isAr
              ? `صور ${catName} ممكن تظهر فيها وجوه أشخاص — أؤكد أن عندي موافقتهم على نشرها.`
              : `If ${catName}'s photos show people, I confirm I have their permission to share them.`}
          </span>
        </label>
      </Dialog>

      {v.isPublic && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {/* Public link */}
          {publicUrl && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2">
              <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                {publicUrl}
              </span>
              <Button size="sm" variant="ghost" onClick={copyLink} aria-label={isAr ? "نسخ" : "Copy"}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="ghost" aria-label={isAr ? "فتح" : "Open"}>
                  <ExternalLink className="size-4" />
                </Button>
              </a>
            </div>
          )}

          {/* Bio */}
          <div>
            <label className="mb-1 block text-xs font-medium">{isAr ? "نبذة (اختياري)" : "Bio (optional)"}</label>
            <textarea
              value={bio ?? ""}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              onBlur={() => bio !== (v.bio ?? "") && patch.mutate({ bio: bio ?? "" })}
              rows={2}
              placeholder={isAr ? `عرّف الناس على ${catName}…` : `Introduce ${catName}…`}
              className="w-full resize-none rounded-xl border border-border bg-card p-2.5 text-sm outline-none ring-primary/20 transition focus:ring-2"
            />
          </div>

          {/* Per-field privacy */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {isAr ? "ماذا يظهر للزوّار؟" : "What visitors can see"}
            </p>
            <div className="space-y-1.5">
              <FieldToggle label={isAr ? "الفصيلة" : "Breed"} on={v.showBreed} onChange={(b) => patch.mutate({ showBreed: b })} />
              <FieldToggle label={isAr ? "العمر" : "Age"} on={v.showAge} onChange={(b) => patch.mutate({ showAge: b })} />
              <FieldToggle label={isAr ? "المدينة" : "City"} on={v.showCity} onChange={(b) => patch.mutate({ showCity: b })} />
              <FieldToggle label={isAr ? "المعرض" : "Gallery"} on={v.showGallery} onChange={(b) => patch.mutate({ showGallery: b })} />
              <FieldToggle label={isAr ? "اسمك" : "Your name"} on={v.showOwnerName} onChange={(b) => patch.mutate({ showOwnerName: b })} />
              {v.showOwnerName && (
                <div className="px-1 pb-1 pt-0.5">
                  <label htmlFor={`nick-${catId}`} className="mb-1 block text-xs font-medium text-muted-foreground">
                    {isAr ? "الاسم اللي يظهر معه" : "The name shown with them"}
                  </label>
                  <input
                    id={`nick-${catId}`}
                    type="text"
                    value={nick ?? ""}
                    maxLength={60}
                    onChange={(e) => setNick(e.target.value)}
                    onBlur={() => nick !== (v.ownerNickname ?? "") && patch.mutate({ ownerNickname: nick ?? "" })}
                    placeholder={isAr ? "بدون اسم — اكتب واحد يظهر" : "Empty means no name shows"}
                    className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Switch({
  on,
  onChange,
  onLabel,
  offLabel,
  onIcon: OnIcon,
  offIcon: OffIcon,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  onLabel: string;
  offLabel: string;
  onIcon: React.ElementType;
  offIcon: React.ElementType;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors",
        on ? "bg-primary/10 text-primary ring-primary/30" : "bg-muted text-muted-foreground ring-border",
        disabled && "opacity-60"
      )}
    >
      {on ? <OnIcon className="size-3.5" /> : <OffIcon className="size-3.5" />}
      {on ? onLabel : offLabel}
    </button>
  );
}

function FieldToggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted-foreground/30")}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
            on ? "start-[1.15rem]" : "start-0.5"
          )}
        />
      </button>
    </label>
  );
}
