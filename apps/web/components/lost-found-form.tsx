"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button, Card, cn } from "@moraqat/ui";
import { SAUDI_CITIES } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useCats } from "@/lib/cat-context";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { Illo3D } from "@/components/illo-3d";
import { PhotoUploader } from "@/components/photo-uploader";
import { localizeName } from "@/lib/translit";
import { friendlyMessage } from "@/lib/errors";
import type { ContactPref, LostFoundKind } from "@/lib/cat-life-api";

/**
 * Filing a lost or found notice.
 *
 * WRITTEN FOR SOMEONE IN A HURRY. Two required fields — what they look like and
 * when — and everything else optional. Picking one of your own registered cats
 * fills in the name, the photo, the city, the chip and the sex in one tap, and
 * flips that cat into lost mode server-side, so nobody has to remember a second
 * switch on the worst day of their week (R002, R115).
 *
 * The microchip field is deliberately prominent on a FOUND notice: it is the
 * only identifier that reunites an unregistered cat, and an exact match
 * notifies the owner immediately.
 */
export function LostFoundForm({
  kind,
  isAr,
  onCancel,
  onCreated,
}: {
  kind: LostFoundKind;
  isAr: boolean;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { authedFetch } = useAuth();
  const { cats } = useCats();
  const lost = kind === "LOST";
  const myCats = cats.filter((c) => c.status === "ACTIVE");

  const [catId, setCatId] = React.useState("");
  const [catName, setCatName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [cityCode, setCityCode] = React.useState("");
  const [district, setDistrict] = React.useState("");
  const [areaNote, setAreaNote] = React.useState("");
  const [gender, setGender] = React.useState("UNKNOWN");
  const [colorNote, setColorNote] = React.useState("");
  const [hasCollar, setHasCollar] = React.useState<"unknown" | "yes" | "no">("unknown");
  const [microchipNo, setMicrochipNo] = React.useState("");
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [happenedAt, setHappenedAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [contactPref, setContactPref] = React.useState<ContactPref>("IN_APP");
  const [contactPhone, setContactPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const chosen = myCats.find((c) => c.id === catId) ?? null;

  // Picking one of my cats fills everything it can.
  const pickCat = (id: string) => {
    if (catId === id) {
      setCatId("");
      return;
    }
    const cat = myCats.find((c) => c.id === id);
    setCatId(id);
    if (cat) {
      setCatName(cat.name);
      setGender(cat.gender ?? "UNKNOWN");
      if (cat.cityCode) setCityCode(cat.cityCode);
      if (cat.photoUrl) setPhotoUrl(cat.photoUrl);
    }
  };

  const create = useMutation({
    mutationFn: () =>
      authedFetch("/lost-found/posts", {
        method: "POST",
        body: JSON.stringify({
          kind,
          ...(catId ? { catId } : {}),
          ...(catName.trim() ? { catName: catName.trim() } : {}),
          description: description.trim(),
          ...(cityCode ? { cityCode } : {}),
          ...(district.trim() ? { district: district.trim() } : {}),
          ...(areaNote.trim() ? { areaNote: areaNote.trim() } : {}),
          gender,
          ...(colorNote.trim() ? { colorNote: colorNote.trim() } : {}),
          ...(hasCollar !== "unknown" ? { hasCollar: hasCollar === "yes" } : {}),
          ...(microchipNo.trim() ? { microchipNo: microchipNo.trim() } : {}),
          ...(photoUrl ? { photoUrl } : {}),
          happenedAt: new Date(happenedAt).toISOString(),
          contactPref,
          ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
        }),
      }),
    onSuccess: onCreated,
    onError: (err) => setError(friendlyMessage(err, isAr)),
  });

  const needsPhone = contactPref === "PHONE" || contactPref === "WHATSAPP";
  const canSubmit = description.trim().length >= 10 && (!needsPhone || contactPhone.trim().length >= 9);

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">
          {lost ? (isAr ? "بلّغ عن قط مفقود" : "Report a lost cat") : isAr ? "بلّغ عن قط لقيته" : "Report a cat you found"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {lost
            ? isAr
              ? "خذ نفس. املأ اللي تقدر عليه الحين — تقدر تكمّل الباقي بعدين، والإعلان ينشر على طول."
              : "Take a breath. Fill in what you can right now — you can add the rest later, and the notice goes up immediately."
            : isAr
              ? "شكراً لك 🤍 أهم شي: الوصف، والمكان، ورقم الشريحة لو تقدر تقرأه عند أقرب عيادة."
              : "Thank you 🤍 What matters most: the description, the place, and a microchip number if a nearby clinic can scan them."}
        </p>
      </div>

      {/* My cats — one tap fills most of the form. */}
      {lost && myCats.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{isAr ? "أي قط ضاع؟" : "Which cat is missing?"}</legend>
          <div className="flex flex-wrap gap-2">
            {myCats.map((c) => {
              const selected = c.id === catId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCat(c.id)}
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
          {chosen && (
            <p className="mt-2 rounded-xl bg-primary/5 p-2.5 text-xs text-muted-foreground">
              {isAr
                ? `بنفعّل وضع «مفقود» على هوية ${localizeName(chosen.name, "ar")} تلقائياً — أي شخص يمسح طوقه بيشوف إنه مفقود ويقدر يراسلك.`
                : `We'll switch ${chosen.name}'s Cat ID into lost mode automatically — anyone who scans their collar sees it and can message you.`}
            </p>
          )}
        </fieldset>
      )}

      {!catId && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {lost ? (isAr ? "اسم القط" : "Their name") : isAr ? "اسم القط لو تعرفه (اختياري)" : "Their name, if you know it (optional)"}
          </span>
          <input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            maxLength={60}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
          />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">{isAr ? "وصفه" : "What do they look like?"}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1500}
          placeholder={
            isAr
              ? "اللون، الحجم، علامة مميزة، طبعه مع الناس…"
              : "Colour, size, a distinctive marking, how they are with people…"
          }
          className="w-full rounded-2xl border border-border bg-background p-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
        />
      </label>

      {/* Photo — the single most useful field after the description. */}
      <div>
        <span className="mb-1 block text-sm font-medium">{isAr ? "صورة" : "A photo"}</span>
        <PhotoUploader
          endpoint="/uploads/image"
          aspect={1}
          maxEdge={900}
          currentUrl={photoUrl}
          isAr={isAr}
          label={lost ? (isAr ? "صورة واضحة لوجهه" : "A clear photo of their face") : isAr ? "صورة للقط اللي لقيته" : "A photo of the cat you found"}
          hint={
            isAr
              ? "الصورة هي أول شي يشوفه الناس — وأكثر شي يخلي أحدهم يتعرف عليه."
              : "The photo is the first thing people see — and the likeliest thing to make someone recognise them."
          }
          onUploaded={(res) => setPhotoUrl((res.url as string) ?? null)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {lost ? (isAr ? "متى ضاع؟" : "When did they go missing?") : isAr ? "متى لقيته؟" : "When did you find them?"}
          </span>
          <input
            type="date"
            value={happenedAt}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setHappenedAt(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
          />
        </label>
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
          <span className="mb-1 block text-sm font-medium">{isAr ? "الحي" : "District"}</span>
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            maxLength={80}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {isAr ? "أقرب معلم" : "Nearest landmark"}
          </span>
          <input
            value={areaNote}
            onChange={(e) => setAreaNote(e.target.value)}
            maxLength={160}
            placeholder={isAr ? "مثلاً: جنب مسجد الحي" : "e.g. by the neighbourhood mosque"}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {isAr ? "ما ننشر عنوان بيتك أبداً — الحي يكفي." : "We never publish a home address — a district is enough."}
          </span>
        </label>
      </div>

      {/* Identifying marks */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{isAr ? "اللون" : "Colour"}</span>
          <input
            value={colorNote}
            onChange={(e) => setColorNote(e.target.value)}
            maxLength={80}
            placeholder={isAr ? "مثلاً: رمادي مخطط بصدر أبيض" : "e.g. grey tabby, white chest"}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {isAr ? "رقم الشريحة" : "Microchip number"}
            {!lost && <span className="ms-1 text-primary">{isAr ? "— الأهم" : "— the big one"}</span>}
          </span>
          <input
            value={microchipNo}
            onChange={(e) => setMicrochipNo(e.target.value)}
            inputMode="numeric"
            dir="ltr"
            maxLength={40}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-2"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {lost
              ? isAr
                ? "لو قطك مشرّح، الرقم يوصله لك أسرع من أي وصف."
                : "If your cat is chipped, the number finds them faster than any description."
              : isAr
                ? "أي عيادة تقرأ الشريحة مجاناً. لو طابقت قطاً مسجّلاً عندنا، صاحبه يوصله إشعار فوراً."
                : "Any clinic will scan a chip for free. If it matches a registered cat, we notify their owner immediately."}
          </span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{isAr ? "الجنس" : "Sex"}</legend>
          <div className="flex gap-1.5">
            {[
              { key: "UNKNOWN", ar: "ما أدري", en: "Not sure" },
              { key: "MALE", ar: "ذكر", en: "Male" },
              { key: "FEMALE", ar: "أنثى", en: "Female" },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setGender(o.key)}
                aria-pressed={gender === o.key}
                className={cn(
                  "min-h-11 rounded-full border px-3 text-xs font-medium transition-colors",
                  gender === o.key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {isAr ? o.ar : o.en}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{isAr ? "طوق" : "Collar"}</legend>
          <div className="flex gap-1.5">
            {[
              { key: "unknown", ar: "ما أدري", en: "Not sure" },
              { key: "yes", ar: "عليه طوق", en: "Wearing one" },
              { key: "no", ar: "بدون", en: "None" },
            ].map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setHasCollar(o.key as typeof hasCollar)}
                aria-pressed={hasCollar === o.key}
                className={cn(
                  "min-h-11 rounded-full border px-3 text-xs font-medium transition-colors",
                  hasCollar === o.key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {isAr ? o.ar : o.en}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* How to be reached — a real decision, stated in words. */}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{isAr ? "كيف يوصلونك؟" : "How should people reach you?"}</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "IN_APP" as const, ar: "رسائل مرقط", en: "Moracat messages" },
            { key: "WHATSAPP" as const, ar: "واتساب", en: "WhatsApp" },
            { key: "PHONE" as const, ar: "اتصال", en: "Phone" },
          ].map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setContactPref(o.key)}
              aria-pressed={contactPref === o.key}
              className={cn(
                "min-h-11 rounded-full border px-3 text-xs font-medium transition-colors",
                contactPref === o.key
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {isAr ? o.ar : o.en}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {contactPref === "IN_APP"
            ? isAr
              ? "ما ننشر رقمك. الرسائل توصلك عبر مرقط وبإشعار على بريدك."
              : "We publish nothing. Messages reach you through Moracat and by email."
            : isAr
              ? "رقمك بيظهر على صفحة الإعلان لأي أحد يفتحها — وهذا أسرع، بس اختيارك."
              : "Your number will be visible on the notice to anyone who opens it — faster, but it's your call."}
        </p>
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
          {isAr ? "انشر الإعلان" : "Post the notice"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {isAr ? "تراجع" : "Cancel"}
        </Button>
      </div>
    </Card>
  );
}
