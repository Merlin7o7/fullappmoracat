"use client";

/**
 * Register a walk-in cat at the counter (MRC-PROD-001 T4).
 *
 * Thirty seconds, two required fields: the cat's name and the owner's mobile.
 * The clinic confirms the owner asked for this, the visit opens, and the
 * claim link appears for the counter screen — the owner scans it, or gets it
 * by SMS when that is switched on. If the cat already exists (same chip, or
 * same owner phone + name) the sheet takes you to it instead of making a twin.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { Button, Drawer, useToast } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";
import { useVetApi, vetFriendlyError, type VetCreatePatientResult } from "@/lib/vet-api";

export function NewPatientSheet({
  open,
  onClose,
  initialName,
  initialPhone,
}: {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  initialPhone?: string;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const api = useVetApi();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = React.useState({ name: initialName ?? "", ownerPhone: initialPhone ?? "", gender: "UNKNOWN", ageMonths: "", microchipNo: "", reason: "" });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setF((p) => ({ ...p, name: initialName ?? p.name, ownerPhone: initialPhone ?? p.ownerPhone }));
  }, [open, initialName, initialPhone]);

  const create = useMutation({
    mutationFn: () => {
      const months = Number(f.ageMonths);
      const birthDate = f.ageMonths && Number.isFinite(months) && months >= 0
        ? new Date(Date.now() - months * 30.44 * 86_400_000).toISOString().slice(0, 10)
        : undefined;
      return api.createPatient({
        name: f.name.trim(),
        ownerPhone: f.ownerPhone.trim(),
        gender: f.gender as "MALE" | "FEMALE" | "UNKNOWN",
        birthDate,
        microchipNo: f.microchipNo.trim() || undefined,
        reason: f.reason.trim() || undefined,
        ownerConsented: true,
      });
    },
    onSuccess: (res: VetCreatePatientResult) => {
      void qc.invalidateQueries({ queryKey: ["vet-visits"] });
      void qc.invalidateQueries({ queryKey: ["vet-patients"] });
      if (!res.created) {
        toast({
          title: isAr ? `${res.match.name} مسجّل بالفعل` : `${res.match.name} is already registered`,
          description: isAr ? "فتحنا ملفه بدل إنشاء نسخة ثانية." : "Opened the existing file instead of creating a twin.",
          variant: "success",
        });
        onClose();
        router.push(`/vet/patients/${encodeURIComponent(res.match.id)}`);
        return;
      }
      toast({
        title: isAr ? `تم تسجيل ${res.cat.name}` : `${res.cat.name} registered`,
        description: isAr ? "الزيارة مفتوحة — اعرض رمز الاستلام للمالك." : "Visit is open — show the owner the claim code.",
        variant: "success",
      });
      onClose();
      router.push(`/vet/patients/${encodeURIComponent(res.cat.catId)}?claim=1`);
    },
    onError: (err) => setError(vetFriendlyError(err, isAr).message),
  });

  const phoneOk = f.ownerPhone.replace(/\D/g, "").length >= 9;

  return (
    <Drawer open={open} onClose={onClose} title={isAr ? "مريض جديد" : "New patient"}>
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); create.mutate(); }}
        className="space-y-4 pt-1"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "سجّل القط بأقل ما يلزم الآن؛ الطبيب يكمل الملف أثناء الزيارة، والمالك يستلم هويته من الرابط."
            : "Register the cat with the minimum now; the vet completes the file during the visit, and the owner claims the ID from the link."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? "اسم القط" : "Cat's name"} required value={f.name} onChange={(v) => setF({ ...f, name: v })} autoFocus />
          <Field label={isAr ? "جوال المالك" : "Owner's mobile"} required type="tel" inputMode="tel" value={f.ownerPhone} onChange={(v) => setF({ ...f, ownerPhone: v })} placeholder="05XXXXXXXX" />
          <SelectField
            label={isAr ? "الجنس" : "Sex"}
            value={f.gender}
            onChange={(v) => setF({ ...f, gender: v })}
            options={[
              { value: "UNKNOWN", label: isAr ? "غير معروف" : "Unknown" },
              { value: "FEMALE", label: isAr ? "أنثى" : "Female" },
              { value: "MALE", label: isAr ? "ذكر" : "Male" },
            ]}
          />
          <Field label={isAr ? "العمر بالأشهر (تقريباً)" : "Age in months (approx.)"} type="number" inputMode="numeric" value={f.ageMonths} onChange={(v) => setF({ ...f, ageMonths: v })} />
          <Field label={isAr ? "رقم الشريحة" : "Microchip"} value={f.microchipNo} onChange={(v) => setF({ ...f, microchipNo: v })} placeholder="968…" />
          <Field label={isAr ? "سبب الزيارة" : "Reason for visit"} value={f.reason} onChange={(v) => setF({ ...f, reason: v })} placeholder={isAr ? "تطعيم أول" : "First vaccination"} />
        </div>
        <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {isAr
            ? "بالتسجيل تؤكد أن المالك طلب ذلك عند الكاونتر. لا يُرسل شيء للمالك قبل موافقته."
            : "By registering you confirm the owner asked for this at the counter. Nothing is sent to the owner without their say-so."}
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={create.isPending} disabled={!f.name.trim() || !phoneOk}>
            <UserPlus className="size-4" /> {isAr ? "سجّل وافتح الزيارة" : "Register and open visit"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>{isAr ? "إلغاء" : "Cancel"}</Button>
        </div>
      </form>
    </Drawer>
  );
}
