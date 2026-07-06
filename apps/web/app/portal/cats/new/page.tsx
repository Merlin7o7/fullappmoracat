"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Loader2, ShieldCheck, Cat as CatIcon } from "lucide-react";
import { Card, Button, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";
import { PhotoUploader } from "@/components/photo-uploader";
import { CatIdCeremony } from "@/components/cat-id-ceremony";
import { CatIdCard } from "@/components/cat-id-card";
import { IlloPaw, IlloHeart, Sticker } from "@/components/illustrations";
import type { PortalCat } from "@/lib/cat-context";

interface Breed { id: string; nameEn: string; nameAr: string }

/**
 * Issuing a Cat ID — the cat's name comes FIRST, and almost nothing else is
 * asked (R016, R002; Dossier north star: under two minutes, under six inputs).
 * Everything optional is postponed and invited later as a benefit to the cat
 * (`?cat=<id>` opens the same page as the "complete the file" form).
 * Never a form for form's sake: the live card preview turns typing the name
 * into watching the identity take shape.
 */
export default function NewCatPage() {
  return (
    <React.Suspense fallback={<div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
      <NewCatInner />
    </React.Suspense>
  );
}

function NewCatInner() {
  const params = useSearchParams();
  const completeCatId = params.get("cat");
  return completeCatId ? <CompleteFileForm catId={completeCatId} /> : <IssueIdFlow />;
}

/* ══ The issue flow · name → contact → ceremony ═══════════════════════════ */

function IssueIdFlow() {
  const router = useRouter();
  const { authedFetch, user, updateUser } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();

  const [step, setStep] = React.useState<0 | 1>(0);
  const [ceremonyCat, setCeremonyCat] = React.useState<PortalCat | null>(null);
  // First-ever Cat ID → after the ceremony, route through the one-time welcome.
  const [firstIssue, setFirstIssue] = React.useState(false);
  const [f, setF] = React.useState({
    name: "",
    photoUrl: "",
    gender: "UNKNOWN",
    ownerName: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    ownerPhone: user?.phone ?? "",
  });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));

  // The name they typed on the landing page follows them here (R016) —
  // they should never have to say it twice (R117).
  React.useEffect(() => {
    try {
      const pending = sessionStorage.getItem("moraqat.pendingCatName");
      if (pending) {
        setF((s) => (s.name ? s : { ...s, name: pending }));
        sessionStorage.removeItem("moraqat.pendingCatName");
      }
    } catch { /* ignore */ }
  }, []);

  const create = useMutation({
    mutationFn: async () => {
      // Save owner edits to the account first (never enter twice).
      const parts = f.ownerName.trim().split(/\s+/);
      if (f.ownerName.trim() || f.ownerPhone.trim()) {
        await authedFetch("/account/profile", {
          method: "PATCH",
          body: JSON.stringify({
            firstName: parts[0] || undefined,
            lastName: parts.slice(1).join(" ") || undefined,
            ...(f.ownerPhone.trim() ? { phone: f.ownerPhone.trim() } : {}),
          }),
        }).catch(() => {});
        updateUser({ firstName: parts[0] || user?.firstName, lastName: parts.slice(1).join(" ") || user?.lastName, phone: f.ownerPhone.trim() || user?.phone });
      }
      return authedFetch<PortalCat & { firstCatIdIssued?: boolean }>("/cats", {
        method: "POST",
        body: JSON.stringify({
          name: f.name.trim(),
          gender: f.gender,
          photoUrl: f.photoUrl.trim() || undefined,
        }),
      });
    },
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["cats"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setFirstIssue(Boolean(cat.firstCatIdIssued));
      setCeremonyCat(cat); // the reveal — then the welcome (first time) or the cats page
    },
    onError: (e: Error) => toast({ title: isAr ? "تعذّر إصدار الهوية" : "Couldn't issue the Cat ID", description: e.message, variant: "error" }),
  });

  const catName = f.name.trim();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="relative mb-8">
        <IlloPaw tone="butter" className="pointer-events-none absolute -top-3 end-0 size-10 rotate-[14deg] opacity-40" />
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {catName
            ? (isAr ? `هوية ${catName} تبدأ هنا` : `${catName}'s ID starts here`)
            : (isAr ? "هوية قطك تبدأ هنا" : "Your cat's ID starts here")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr ? "اسمه أولاً — وكل شي ثاني يقدر ينتظر" : "Their name first — everything else can wait"}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_minmax(0,20rem)]">
        <Card className="p-6 sm:p-7">
          {/* Two quiet dots — the whole journey is visible at a glance (R005). */}
          <div className="mb-6 flex items-center gap-2" aria-hidden>
            {[0, 1].map((i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i === step ? "w-8 bg-primary" : "w-1.5 bg-border", i < step && "bg-primary/40")} />
            ))}
            <span className="ms-2 text-xs text-muted-foreground">
              {step === 0 ? (isAr ? "قطك" : "Your cat") : (isAr ? "التواصل" : "Contact")} · {step + 1}/2
            </span>
          </div>

          {step === 0 ? (
            <form onSubmit={(e) => { e.preventDefault(); if (catName) setStep(1); }} className="flex flex-col gap-4">
              <Field
                label={isAr ? "وش اسم قطك؟" : "What's your cat's name?"}
                required
                value={f.name}
                onChange={(v) => set({ name: v.slice(0, 60) })}
                placeholder={isAr ? "مثلاً: سمسم" : "e.g. Simba"}
                autoFocus
              />
              <SelectField
                label={isAr ? "الجنس (اختياري)" : "Sex (optional)"}
                value={f.gender}
                onChange={(v) => set({ gender: v })}
                options={[
                  { value: "UNKNOWN", label: isAr ? "غير محدد" : "Not sure" },
                  { value: "MALE", label: isAr ? "ذكر" : "Male" },
                  { value: "FEMALE", label: isAr ? "أنثى" : "Female" },
                ]}
              />
              <PhotoUploader
                endpoint="/uploads/image"
                aspect={1}
                rounded
                maxEdge={800}
                currentUrl={f.photoUrl || null}
                isAr={isAr}
                label={isAr ? "صورته (اختياري — تطلع على الهوية)" : "Photo (optional — it goes on the ID)"}
                onUploaded={(res) => set({ photoUrl: (res.url as string) ?? "" })}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/portal/cats")}>
                  <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" size="lg" disabled={!catName}>
                  {isAr ? "التالي" : "Next"} <ArrowRight className="size-4 rtl:rotate-180" />
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="flex flex-col gap-4">
              <Field label={isAr ? "اسمك الكامل" : "Your full name"} required value={f.ownerName} onChange={(v) => set({ ownerName: v })} />
              <Field label={isAr ? "رقم جوالك" : "Your mobile number"} value={f.ownerPhone} onChange={(v) => set({ ownerPhone: v })} inputMode="tel" />
              {/* Trust precedes the ask (R004): say plainly why we want a number. */}
              <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                {isAr
                  ? `لو ضاع ${catName || "قطك"} يوم من الأيام، هذا الرقم اللي يوصله له اللي يلقاه.`
                  : `If ${catName || "your cat"} is ever lost, this is the number that brings them home.`}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(0)} disabled={create.isPending}>
                  <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "رجوع" : "Back"}
                </Button>
                <Button type="submit" size="lg" disabled={!catName || create.isPending}>
                  {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <CatIcon className="size-4" />}
                  {isAr ? `أصدر هوية ${catName || "القط"}` : catName ? `Issue ${catName}'s Cat ID` : "Issue the Cat ID"}
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* The identity taking shape, live — the same card from the landing page,
            about to become real (R035). */}
        <div className="relative mx-auto w-full max-w-xs lg:sticky lg:top-24">
          <Sticker rotate={12} float className="-end-4 -top-5 hidden sm:block">
            <IlloHeart tone="pink" className="size-8" />
          </Sticker>
          <CatIdCard
            catName={catName || (isAr ? "قطك" : "Your cat")}
            catIdNumber="MRC-····-····"
            photoUrl={f.photoUrl.trim() || null}
            isAr={isAr}
            preview
          />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {isAr ? "رقمه الحقيقي ينطبع لحظة الإصدار" : "The real number is stamped the moment it's issued"}
          </p>
        </div>
      </div>

      {ceremonyCat?.catIdNumber && (
        <CatIdCeremony
          cat={{ name: ceremonyCat.name, catIdNumber: ceremonyCat.catIdNumber, idIssuedAt: ceremonyCat.idIssuedAt, photoUrl: ceremonyCat.photoUrl }}
          isAr={isAr}
          onShareChoice={async (makePublic) => {
            try {
              await authedFetch(`/cats/${ceremonyCat.id}/visibility`, {
                method: "PATCH",
                body: JSON.stringify({ isPublic: makePublic }),
              });
            } catch {
              /* non-blocking — they can change it later in settings */
            }
          }}
          onClose={() =>
            router.push(
              firstIssue
                ? `/portal/welcome?cat=${ceremonyCat.id}`
                : "/portal/cats"
            )
          }
        />
      )}
    </div>
  );
}

/* ══ The invited follow-up · complete the cat's file (postponed on purpose) ═ */

interface CatFileDetail {
  id: string; name: string;
  birthDate?: string | null; breedId?: string | null; breed?: { id: string } | null;
  coatColor?: string | null; weightKg?: number | null;
  favoriteFoods?: string[]; isIndoor?: boolean; isNeutered?: boolean | null;
  vaccinationStatus?: string | null;
  allergies?: string[]; healthConditions?: string[];
  currentMedications?: string | null; emergencyNotes?: string | null;
}

function CompleteFileForm({ catId }: { catId: string }) {
  const router = useRouter();
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();

  const { data: cat, isLoading } = useQuery({
    queryKey: ["cat-file", catId],
    queryFn: () => authedFetch<CatFileDetail>(`/cats/${catId}`),
    enabled: !!user,
  });
  const { data: breeds } = useQuery({
    queryKey: ["breeds"],
    queryFn: () => authedFetch<Breed[]>("/cats/meta/breeds"),
    enabled: !!user,
  });

  const [f, setF] = React.useState({
    birthDate: "", breedId: "", coatColor: "", weightKg: "",
    favoriteFood: "", isIndoor: "true", isNeutered: "unknown",
    vaccinationStatus: "UNKNOWN", allergies: "", medicalConditions: "", currentMedications: "", emergencyNotes: "",
  });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));

  // Prefill once from the record — never make the member repeat themselves (R117).
  const filled = React.useRef(false);
  React.useEffect(() => {
    if (!cat || filled.current) return;
    filled.current = true;
    setF({
      birthDate: cat.birthDate ? cat.birthDate.slice(0, 10) : "",
      breedId: cat.breedId ?? cat.breed?.id ?? "",
      coatColor: cat.coatColor ?? "",
      weightKg: cat.weightKg != null ? String(cat.weightKg) : "",
      favoriteFood: cat.favoriteFoods?.[0] ?? "",
      isIndoor: cat.isIndoor === false ? "false" : "true",
      isNeutered: cat.isNeutered == null ? "unknown" : cat.isNeutered ? "true" : "false",
      vaccinationStatus: cat.vaccinationStatus ?? "UNKNOWN",
      allergies: (cat.allergies ?? []).join(", "),
      medicalConditions: (cat.healthConditions ?? []).join(", "),
      currentMedications: cat.currentMedications ?? "",
      emergencyNotes: cat.emergencyNotes ?? "",
    });
  }, [cat]);

  const save = useMutation({
    mutationFn: () =>
      authedFetch(`/cats/${catId}`, {
        method: "PATCH",
        body: JSON.stringify({
          birthDate: f.birthDate || undefined,
          breedId: f.breedId || undefined,
          coatColor: f.coatColor || undefined,
          weightKg: f.weightKg ? Number(f.weightKg) : undefined,
          favoriteFoods: f.favoriteFood ? [f.favoriteFood] : undefined,
          isIndoor: f.isIndoor === "true",
          isNeutered: f.isNeutered === "unknown" ? undefined : f.isNeutered === "true",
          vaccinationStatus: f.vaccinationStatus,
          allergies: splitList(f.allergies),
          healthConditions: splitList(f.medicalConditions),
          currentMedications: f.currentMedications || undefined,
          emergencyNotes: f.emergencyNotes || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cats"] });
      qc.invalidateQueries({ queryKey: ["cat-file", catId] });
      toast({ title: isAr ? `ملف ${cat?.name ?? ""} اكتمل 🐾` : `${cat?.name ?? "The"} file is complete 🐾` });
      router.push("/portal/cats");
    },
    onError: (e: Error) => toast({ title: isAr ? "ما قدرنا نحفظ" : "Couldn't save", description: e.message, variant: "error" }),
  });

  if (isLoading || !cat) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="relative">
        <IlloPaw tone="peach" className="pointer-events-none absolute -top-3 end-0 size-10 rotate-[14deg] opacity-40" />
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {isAr ? `أكمل ملف ${cat.name}` : `Complete ${cat.name}'s file`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr
            ? "كل معلومة تضيفها تخلّي أي عيادة تساعده أسرع — وكلها اختيارية"
            : "Every detail helps any clinic help them faster — and all of it is optional"}
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6">
        <Card className="p-6">
          <SectionTitle title={isAr ? "تعريفه" : "About them"} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isAr ? "تاريخ الميلاد" : "Date of birth"} type="date" value={f.birthDate} onChange={(v) => set({ birthDate: v })} />
            <SelectField label={isAr ? "الفصيلة" : "Breed"} value={f.breedId} onChange={(v) => set({ breedId: v })}
              options={[{ value: "", label: isAr ? "غير محدد" : "Not sure" }, ...(breeds ?? []).map((b) => ({ value: b.id, label: isAr ? b.nameAr : b.nameEn }))]} />
            <Field label={isAr ? "لون الفراء" : "Coat colour"} value={f.coatColor} onChange={(v) => set({ coatColor: v })} placeholder={isAr ? "مثلاً: مشمشي" : "e.g. Ginger"} />
            <Field label={isAr ? "الوزن (كجم)" : "Weight (kg)"} type="number" value={f.weightKg} onChange={(v) => set({ weightKg: v })} placeholder="4.5" />
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle title={isAr ? "حياته وطعامه" : "Lifestyle & food"} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isAr ? "الطعام المفضّل" : "Favourite food"} value={f.favoriteFood} onChange={(v) => set({ favoriteFood: v })} placeholder="Royal Canin" />
            <SelectField label={isAr ? "البيئة" : "Environment"} value={f.isIndoor} onChange={(v) => set({ isIndoor: v })}
              options={[{ value: "true", label: isAr ? "داخلي" : "Indoor" }, { value: "false", label: isAr ? "خارجي" : "Outdoor" }]} />
            <SelectField label={isAr ? "معقّم/محيّد؟" : "Neutered / spayed?"} value={f.isNeutered} onChange={(v) => set({ isNeutered: v })}
              options={[{ value: "true", label: isAr ? "نعم" : "Yes" }, { value: "false", label: isAr ? "لا" : "No" }, { value: "unknown", label: isAr ? "غير متأكد" : "Not sure" }]} />
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle title={isAr ? "ملفه الصحي" : "Health file"} hint={isAr ? "يظهر لأي عيادة شريكة عند مسح هويته" : "Shown to any partner clinic that scans their ID"} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={isAr ? "حالة التطعيم" : "Vaccination status"} value={f.vaccinationStatus} onChange={(v) => set({ vaccinationStatus: v })}
              options={[
                { value: "UP_TO_DATE", label: isAr ? "محدّثة" : "Up to date" },
                { value: "PARTIAL", label: isAr ? "جزئية" : "Partial" },
                { value: "NONE", label: isAr ? "لا يوجد" : "None" },
                { value: "UNKNOWN", label: isAr ? "غير معروف" : "Unknown" },
              ]} />
            <Field label={isAr ? "الحساسيات (افصلها بفواصل)" : "Allergies (comma-separated)"} value={f.allergies} onChange={(v) => set({ allergies: v })} />
            <Field label={isAr ? "حالات مرضية (افصلها بفواصل)" : "Medical conditions (comma-separated)"} value={f.medicalConditions} onChange={(v) => set({ medicalConditions: v })} />
            <Field label={isAr ? "أدوية حالية" : "Current medications"} value={f.currentMedications} onChange={(v) => set({ currentMedications: v })} />
            <div className="sm:col-span-2">
              <Field label={isAr ? "ملاحظات طوارئ" : "Emergency notes"} value={f.emergencyNotes} onChange={(v) => set({ emergencyNotes: v })} />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/portal/cats")} disabled={save.isPending}>
            <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "لاحقاً" : "Later"}
          </Button>
          <Button type="submit" size="lg" loading={save.isPending}>
            {isAr ? `احفظ ملف ${cat.name}` : `Save ${cat.name}'s file`}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function splitList(s: string): string[] | undefined {
  const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}
