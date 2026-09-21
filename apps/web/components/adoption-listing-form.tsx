"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button, Card, cn } from "@moraqat/ui";
import { SAUDI_CITIES, digitsOnly } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { Illo3D } from "@/components/illo-3d";
import { localizeName } from "@/lib/translit";
import { friendlyMessage } from "@/lib/errors";
import type { PortalCat } from "@/lib/cat-context";
import type { ContactPref } from "@/lib/cat-life-api";

/**
 * Listing a cat for adoption.
 *
 * Deciding to rehome a cat is rarely a happy decision, so this form does not
 * behave like a "create listing" wizard. It asks for the story first — the one
 * field that actually finds a home — and treats everything else as optional
 * detail (R002, R081). There is no "sell your cat" framing anywhere, and the
 * fee field defaults to zero with the honest label beside it.
 *
 * The contact choice is the privacy decision, so it is stated in plain words
 * rather than as a toggle with a label: in-app relay reveals nothing, a
 * published number reveals a number (R106).
 */

const TRI = [
  { key: "unknown", ar: "ما أدري", en: "Not sure" },
  { key: "yes", ar: "نعم", en: "Yes" },
  { key: "no", ar: "لا", en: "No" },
] as const;

type Tri = (typeof TRI)[number]["key"];

const triToBool = (v: Tri) => (v === "unknown" ? undefined : v === "yes");

export function AdoptionListingForm({
  cats,
  isAr,
  onCancel,
  onCreated,
}: {
  cats: PortalCat[];
  isAr: boolean;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { authedFetch } = useAuth();
  const [catId, setCatId] = React.useState(cats[0]?.id ?? "");
  const [story, setStory] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [cityCode, setCityCode] = React.useState("");
  const [district, setDistrict] = React.useState("");
  const [feeSar, setFeeSar] = React.useState("");
  const [kids, setKids] = React.useState<Tri>("unknown");
  const [otherCats, setOtherCats] = React.useState<Tri>("unknown");
  const [dogs, setDogs] = React.useState<Tri>("unknown");
  const [contactPref, setContactPref] = React.useState<ContactPref>("IN_APP");
  const [contactPhone, setContactPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const cat = cats.find((c) => c.id === catId) ?? null;
  const catName = cat ? localizeName(cat.name, isAr ? "ar" : "en") : "";

  // Prefill the city from the cat's census city — they almost always match, and
  // a prefilled right answer is worth more than an empty required field.
  React.useEffect(() => {
    if (cat?.cityCode && !cityCode) setCityCode(cat.cityCode);
  }, [cat, cityCode]);

  const create = useMutation({
    mutationFn: () =>
      authedFetch("/adoption/listings", {
        method: "POST",
        body: JSON.stringify({
          catId,
          story: story.trim(),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(cityCode ? { cityCode } : {}),
          ...(district.trim() ? { district: district.trim() } : {}),
          feeSar: Number(feeSar) || 0,
          ...(triToBool(kids) !== undefined ? { goodWithKids: triToBool(kids) } : {}),
          ...(triToBool(otherCats) !== undefined ? { goodWithCats: triToBool(otherCats) } : {}),
          ...(triToBool(dogs) !== undefined ? { goodWithDogs: triToBool(dogs) } : {}),
          contactPref,
          ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
        }),
      }),
    onSuccess: onCreated,
    onError: (err) => setError(friendlyMessage(err, isAr)),
  });

  if (cats.length === 0) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        {isAr
          ? "كل قططك معروضة أصلاً، أو ما عندك قط نشِط تعرضه."
          : "All your cats are already listed, or you have no active cat to list."}
      </Card>
    );
  }

  const needsPhone = contactPref === "PHONE" || contactPref === "WHATSAPP";
  const canSubmit = !!catId && story.trim().length >= 20 && (!needsPhone || contactPhone.trim().length >= 9);

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">
          {isAr ? "اعرض قطاً للتبني" : "List a cat for adoption"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "قرار صعب، ونحترمه. اللي يهمنا إن القط يوصل بيتاً طيباً — وهويته وسجله ينتقلان معه."
            : "A hard decision, and we respect it. What matters is that they land somewhere good — with their Cat ID and record intact."}
        </p>
      </div>

      {/* Which cat — pictures, not a dropdown of names (P09). */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{isAr ? "أي قط؟" : "Which cat?"}</legend>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => {
            const selected = c.id === catId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatId(c.id)}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-[44px] items-center gap-2 rounded-2xl border p-2 pe-3 text-sm transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                )}
              >
                <ImgWithFallback
                  src={c.photoUrl}
                  alt=""
                  className="size-10 rounded-xl object-cover"
                  fallback={
                    <span className="grid size-10 place-items-center rounded-xl bg-cream/60">
                      <Illo3D name="cat" className="size-8" px={64} shadow={false} />
                    </span>
                  }
                />
                <span className="font-medium">{localizeName(c.name, isAr ? "ar" : "en")}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* The story — the field that actually finds a home. */}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {isAr ? `احكِ لنا عن ${catName || "قطك"}` : `Tell us about ${catName || "them"}`}
        </span>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={6}
          maxLength={2000}
          placeholder={
            isAr
              ? "طبعه، وش يحب، كيف يتعامل مع الناس، وش يخوّفه، وش يحتاج في بيته الجديد…"
              : "Their character, what they love, how they are with people, what frightens them, what they'll need…"
          }
          className="w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          {story.trim().length < 20
            ? isAr
              ? "هذي أهم خانة في الصفحة — خذ وقتك فيها."
              : "This is the most important field on the page — take your time with it."
            : `${story.length}/2000`}
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {isAr ? "ليش تدوّر له بيتاً؟ (اختياري)" : "Why are you rehoming them? (optional)"}
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          placeholder={isAr ? "مثلاً: سفر، أو حساسية في البيت" : "e.g. moving abroad, or an allergy at home"}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          {isAr ? "الصراحة تريح المتبنّي أكثر من أي شي." : "Honesty here reassures an adopter more than anything else."}
        </span>
      </label>

      {/* Where */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{isAr ? "المدينة" : "City"}</span>
          <select
            value={cityCode}
            onChange={(e) => setCityCode(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
          >
            <option value="">{isAr ? "اختر مدينة" : "Choose a city"}</option>
            {SAUDI_CITIES.map((c) => (
              <option key={c.code} value={c.code}>
                {isAr ? c.ar : c.en}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{isAr ? "الحي (اختياري)" : "District (optional)"}</span>
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            maxLength={80}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
          />
        </label>
      </div>

      {/* Household fit — tri-state, because "not sure" is an honest answer. */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{isAr ? "كيف هو مع…" : "How are they with…"}</legend>
        <div className="space-y-2">
          <TriRow label={isAr ? "الأطفال" : "Kids"} value={kids} onChange={setKids} isAr={isAr} />
          <TriRow label={isAr ? "القطط الثانية" : "Other cats"} value={otherCats} onChange={setOtherCats} isAr={isAr} />
          <TriRow label={isAr ? "الكلاب" : "Dogs"} value={dogs} onChange={setDogs} isAr={isAr} />
        </div>
      </fieldset>

      {/* The fee — present, minimised, honestly labelled. */}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {isAr ? "مقابل رمزي بالريال (اختياري)" : "A rehoming fee in SAR (optional)"}
        </span>
        <input
          value={feeSar}
          onChange={(e) => setFeeSar(digitsOnly(e.target.value).slice(0, 4))}
          inputMode="numeric"
          dir="ltr"
          placeholder="0"
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2 sm:w-40"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          {isAr
            ? "اتركها صفراً وتظهر «بدون مقابل». مرقط ما يأخذ عمولة ولا يمرّ المبلغ عبرنا."
            : "Leave it at zero and the page reads “free to a good home”. Moracat takes no commission and the money never passes through us."}
        </span>
      </label>

      {/* Contact — the privacy decision, in words. */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{isAr ? "كيف يوصلونك؟" : "How should adopters reach you?"}</legend>
        <div className="space-y-2">
          <ContactChoice
            checked={contactPref === "IN_APP"}
            onSelect={() => setContactPref("IN_APP")}
            title={isAr ? "رسائل داخل مرقط" : "Messages inside Moracat"}
            body={isAr ? "ما نكشف رقمك ولا بريدك لأحد. الخيار الأكثر أماناً." : "We never reveal your number or email. The safest option."}
          />
          <ContactChoice
            checked={contactPref === "WHATSAPP"}
            onSelect={() => setContactPref("WHATSAPP")}
            title={isAr ? "واتساب" : "WhatsApp"}
            body={isAr ? "نعطي رقمك فقط لمن توافق عليه." : "Your number is released only to someone you accept."}
          />
          <ContactChoice
            checked={contactPref === "PHONE"}
            onSelect={() => setContactPref("PHONE")}
            title={isAr ? "اتصال" : "A phone call"}
            body={isAr ? "نعطي رقمك فقط لمن توافق عليه." : "Your number is released only to someone you accept."}
          />
        </div>
        {needsPhone && (
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            inputMode="tel"
            dir="ltr"
            placeholder="05X XXX XXXX"
            className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2 sm:w-56"
          />
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
          {create.isPending && <Loader2 className="size-4 animate-spin" />}
          {isAr ? `اعرض ${catName}` : `List ${catName}`}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {isAr ? "تراجع" : "Cancel"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "تقدر تسحب الإعلان في أي لحظة بضغطة واحدة. ما ينتقل القط إلا لما توافق على شخص وترسل هويته بنفسك."
          : "You can take the listing down in one tap, any time. No cat moves until you accept someone and send their Cat ID yourself."}
      </p>
    </Card>
  );
}

function TriRow({
  label,
  value,
  onChange,
  isAr,
}: {
  label: string;
  value: Tri;
  onChange: (v: Tri) => void;
  isAr: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-1.5">
        {TRI.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={value === t.key}
            className={cn(
              "min-h-11 rounded-full border px-3 text-xs font-medium transition-colors",
              value === t.key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {isAr ? t.ar : t.en}
          </button>
        ))}
      </div>
    </div>
  );
}

function ContactChoice({
  checked,
  onSelect,
  title,
  body,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-3 text-start transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2",
          checked ? "border-primary" : "border-muted-foreground/40"
        )}
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}
