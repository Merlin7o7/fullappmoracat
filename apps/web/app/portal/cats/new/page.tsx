"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Loader2, User, Cat as CatIcon, Heart, Stethoscope, Check } from "lucide-react";
import { Card, Button, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";
import { CatIdCeremony } from "@/components/cat-id-ceremony";
import { IlloPaw } from "@/components/illustrations";
import type { PortalCat } from "@/lib/cat-context";

interface Breed { id: string; nameEn: string; nameAr: string }

const STEPS = [
  { key: "owner", icon: User, ar: "المالك", en: "Owner" },
  { key: "cat", icon: CatIcon, ar: "قطك", en: "Your cat" },
  { key: "care", icon: Heart, ar: "الحياة والطعام", en: "Lifestyle" },
  { key: "health", icon: Stethoscope, ar: "الصحة", en: "Health" },
] as const;

export default function NewCatPage() {
  const router = useRouter();
  const { authedFetch, user, updateUser } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();

  const [step, setStep] = React.useState(0);
  const [ceremonyCat, setCeremonyCat] = React.useState<PortalCat | null>(null);
  const [f, setF] = React.useState({
    ownerName: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    ownerPhone: user?.phone ?? "",
    name: "", gender: "UNKNOWN", birthDate: "", breedId: "", coatColor: "", weightKg: "",
    favoriteFood: "", isIndoor: "true", isNeutered: "unknown",
    vaccinationStatus: "UNKNOWN", allergies: "", medicalConditions: "", currentMedications: "", emergencyNotes: "", photoUrl: "",
  });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));

  const { data: breeds } = useQuery({
    queryKey: ["breeds"],
    queryFn: () => authedFetch<Breed[]>("/cats/meta/breeds"),
    enabled: !!user,
  });

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
      return authedFetch<PortalCat>("/cats", {
        method: "POST",
        body: JSON.stringify({
          name: f.name,
          gender: f.gender,
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
          photoUrl: f.photoUrl || undefined,
        }),
      });
    },
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["cats"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setCeremonyCat(cat); // the reveal — then straight into the subscription journey
    },
    onError: (e: Error) => toast({ title: isAr ? "تعذّر إصدار الهوية" : "Couldn't issue the Cat ID", description: e.message, variant: "error" }),
  });

  const canNext = step !== 1 || f.name.trim().length > 0;
  const last = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="relative">
        <IlloPaw tone="butter" className="pointer-events-none absolute -top-3 end-0 size-10 rotate-[14deg] opacity-40" />
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isAr ? "سجّل قطك" : "Register your cat"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAr ? "نجمع ملفه كامل، وبعدها نصدر هويته الرسمية" : "We collect their full profile, then issue their official Cat ID"}
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {i < step ? <Check className="size-4" /> : <s.icon className="size-4" />}
              <span className="hidden sm:inline">{isAr ? s.ar : s.en}</span>
            </div>
            {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < step ? "bg-primary/40" : "bg-border")} />}
          </React.Fragment>
        ))}
      </div>

      <Card className="p-6">
        {step === 0 && (
          <Section title={isAr ? "بيانات المالك" : "Owner details"} hint={isAr ? "من حسابك — عدّلها إذا تبي" : "From your account — edit if needed"}>
            <Field label={isAr ? "الاسم الكامل" : "Full name"} value={f.ownerName} onChange={(v) => set({ ownerName: v })} />
            <Field label={isAr ? "رقم الجوال" : "Mobile number"} value={f.ownerPhone} onChange={(v) => set({ ownerPhone: v })} inputMode="tel" />
            <Field label={isAr ? "البريد الإلكتروني" : "Email"} value={user?.email ?? ""} onChange={() => {}} />
          </Section>
        )}

        {step === 1 && (
          <Section title={isAr ? "تعريف قطك" : "About your cat"}>
            <Field label={isAr ? "اسم القط" : "Cat name"} required value={f.name} onChange={(v) => set({ name: v })} placeholder={isAr ? "مثلاً: مشمش" : "e.g. Simba"} />
            <SelectField label={isAr ? "الجنس" : "Sex"} value={f.gender} onChange={(v) => set({ gender: v })}
              options={[{ value: "MALE", label: isAr ? "ذكر" : "Male" }, { value: "FEMALE", label: isAr ? "أنثى" : "Female" }, { value: "UNKNOWN", label: isAr ? "غير محدد" : "Unknown" }]} />
            <Field label={isAr ? "تاريخ الميلاد" : "Date of birth"} type="date" value={f.birthDate} onChange={(v) => set({ birthDate: v })} />
            <SelectField label={isAr ? "الفصيلة" : "Breed"} value={f.breedId} onChange={(v) => set({ breedId: v })}
              options={[{ value: "", label: isAr ? "غير محدد" : "Not sure" }, ...(breeds ?? []).map((b) => ({ value: b.id, label: isAr ? b.nameAr : b.nameEn }))]} />
            <Field label={isAr ? "لون الفراء" : "Coat colour"} value={f.coatColor} onChange={(v) => set({ coatColor: v })} placeholder={isAr ? "مثلاً: مشمشي" : "e.g. Ginger"} />
            <Field label={isAr ? "الوزن (كجم)" : "Weight (kg)"} type="number" value={f.weightKg} onChange={(v) => set({ weightKg: v })} placeholder="4.5" />
          </Section>
        )}

        {step === 2 && (
          <Section title={isAr ? "الحياة والطعام" : "Lifestyle & food"}>
            <Field label={isAr ? "الطعام المفضّل" : "Favourite food"} value={f.favoriteFood} onChange={(v) => set({ favoriteFood: v })} placeholder="Royal Canin" />
            <SelectField label={isAr ? "البيئة" : "Environment"} value={f.isIndoor} onChange={(v) => set({ isIndoor: v })}
              options={[{ value: "true", label: isAr ? "داخلي" : "Indoor" }, { value: "false", label: isAr ? "خارجي" : "Outdoor" }]} />
            <SelectField label={isAr ? "معقّم/محيّد؟" : "Neutered / spayed?"} value={f.isNeutered} onChange={(v) => set({ isNeutered: v })}
              options={[{ value: "true", label: isAr ? "نعم" : "Yes" }, { value: "false", label: isAr ? "لا" : "No" }, { value: "unknown", label: isAr ? "غير متأكد" : "Not sure" }]} />
            <Field label={isAr ? "رابط صورة القط (اختياري)" : "Cat photo URL (optional)"} value={f.photoUrl} onChange={(v) => set({ photoUrl: v })} placeholder="https://…" />
          </Section>
        )}

        {step === 3 && (
          <Section title={isAr ? "الملف الصحي" : "Health profile"} hint={isAr ? "كله اختياري عدا حالة التطعيم" : "All optional except vaccination status"}>
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
            <Field label={isAr ? "ملاحظات طوارئ" : "Emergency notes"} value={f.emergencyNotes} onChange={(v) => set({ emergencyNotes: v })} />
          </Section>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => (step === 0 ? router.push("/portal/cats") : setStep((s) => s - 1))} disabled={create.isPending}>
            <ArrowLeft className="size-4 rtl:rotate-180" /> {step === 0 ? (isAr ? "إلغاء" : "Cancel") : (isAr ? "رجوع" : "Back")}
          </Button>
          {last ? (
            <Button size="lg" onClick={() => create.mutate()} disabled={!f.name.trim() || create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <CatIcon className="size-4" />}
              {isAr ? `أصدر هوية ${f.name || "القط"}` : `Issue ${f.name || "the"} Cat ID`}
            </Button>
          ) : (
            <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              {isAr ? "التالي" : "Next"} <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          )}
        </div>
      </Card>

      {ceremonyCat?.catIdNumber && (
        <CatIdCeremony
          cat={{ name: ceremonyCat.name, catIdNumber: ceremonyCat.catIdNumber, idIssuedAt: ceremonyCat.idIssuedAt, photoUrl: ceremonyCat.photoUrl }}
          isAr={isAr}
          onClose={() => router.push(`/portal/subscribe?cat=${ceremonyCat.id}`)}
        />
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function splitList(s: string): string[] | undefined {
  const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}
