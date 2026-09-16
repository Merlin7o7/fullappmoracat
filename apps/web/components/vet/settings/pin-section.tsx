"use client";

/**
 * My counter PIN (MRC-VET-001 §02). Per-person, never printed, set only from a
 * personal session — a PIN typed at the shared terminal is a PIN everyone saw.
 * A manager can clear a PIN but never set one, so this is the only place a PIN
 * is ever chosen. The staff number shown here is what the counter asks for.
 */

import * as React from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Badge, Button, Input, useToast } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { useVetActor, useVetFetch } from "@/lib/vet-api";
import { SectionCard } from "@/components/vet/vet-shell-bits";
import { InlineError } from "./confirm-dialog";
import { settingsError } from "./errors";
import { useInvalidateOnboarding } from "./use-onboarding";

const PIN_RE = /^\d{4,6}$/;

export function PinSection() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { toast } = useToast();
  const vetFetch = useVetFetch();
  const { org, refresh } = useVetActor();
  const invalidateOnboarding = useInvalidateOnboarding();

  const hasPin = !!org?.hasCounterPin;
  const [open, setOpen] = React.useState(false);
  const [currentPin, setCurrentPin] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ title: string; message: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const digits = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, "").slice(0, 6);

  function reset() {
    setCurrentPin("");
    setPin("");
    setConfirmPin("");
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!PIN_RE.test(pin)) {
      setError(
        isAr
          ? { title: "الرمز من ٤ إلى ٦ أرقام", message: "اختر رمزاً تتذكره ولا يسهل تخمينه — تجنّب ١٢٣٤ وتاريخ ميلادك." }
          : { title: "A PIN is 4 to 6 digits", message: "Pick one you'll remember that isn't easy to guess — avoid 1234 and your birthday." },
      );
      return;
    }
    if (pin !== confirmPin) {
      setError(
        isAr
          ? { title: "الرمزان غير متطابقين", message: "اكتب الرمز الجديد نفسه في الخانتين." }
          : { title: "The PINs don't match", message: "Type the same new PIN in both boxes." },
      );
      return;
    }
    if (hasPin && !PIN_RE.test(currentPin)) {
      setError(
        isAr
          ? { title: "اكتب رمزك الحالي", message: "لتغيير الرمز نحتاج رمزك الحالي أولاً. نسيته؟ مدير العيادة يستطيع مسحه." }
          : { title: "Enter your current PIN", message: "Changing a PIN needs the current one first. Forgotten it? A clinic manager can clear it." },
      );
      return;
    }
    setBusy(true);
    try {
      await vetFetch("/vet/staff/me/pin", {
        method: "PUT",
        body: JSON.stringify({ pin, ...(hasPin ? { currentPin } : {}) }),
      });
      reset();
      setOpen(false);
      void refresh();
      void invalidateOnboarding();
      toast({
        title: hasPin ? (isAr ? "تغيّر رمزك السري" : "PIN changed") : isAr ? "عُيّن رمزك السري" : "PIN set",
        description: isAr
          ? "استخدمه مع رقم الموظف لفتح الكاونتر. لا تشاركه مع أحد."
          : "Use it with your staff number to unlock the counter. Don't share it with anyone.",
        variant: "success",
      });
    } catch (err) {
      setError(settingsError(err, isAr));
      setCurrentPin("");
    } finally {
      setBusy(false);
    }
  }

  async function copyStaffNumber() {
    if (!org?.staffId) return;
    try {
      await navigator.clipboard.writeText(org.staffId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the number is still selectable on screen */
    }
  }

  const pinInputClass = "h-12 text-center font-mono text-lg tracking-[0.5em]";

  return (
    <SectionCard
      title={isAr ? "رمزي السري للكاونتر" : "My counter PIN"}
      hint={
        isAr
          ? "لفتح جهاز الاستقبال المشترك باسمك. خاص بك — لا يعرفه حتى مدير العيادة."
          : "Unlocks the shared front-desk device as you. Yours alone — not even a manager knows it."
      }
      icon={KeyRound}
      action={
        <Badge variant={hasPin ? "success" : "warning"} dot>
          {hasPin ? (isAr ? "معيّن" : "Set") : isAr ? "غير معيّن" : "Not set"}
        </Badge>
      }
    >
      <div className="flex flex-col gap-4">
        {org?.staffId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {isAr ? "رقم الموظف — يطلبه الكاونتر مع الرمز" : "Staff number — the counter asks for it with your PIN"}
              </p>
              <p dir="ltr" className="mt-0.5 select-all break-all text-start font-mono text-sm">
                {org.staffId}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void copyStaffNumber()} aria-live="polite">
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? (isAr ? "نُسخ" : "Copied") : isAr ? "انسخ" : "Copy"}
            </Button>
          </div>
        )}

        {!open ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {hasPin
                ? isAr
                  ? "رمزك معيّن. غيّره متى شئت — تحتاج الرمز الحالي."
                  : "Your PIN is set. Change it any time — you'll need the current one."
                : isAr
                  ? "عيّن رمزاً من ٤ إلى ٦ أرقام لتعمل على جهاز الاستقبال."
                  : "Set a 4–6 digit PIN to work on the front-desk device."}
            </p>
            <Button
              size="sm"
              variant={hasPin ? "outline" : "brand"}
              onClick={() => {
                reset();
                setOpen(true);
              }}
            >
              {hasPin ? (isAr ? "غيّر الرمز" : "Change PIN") : isAr ? "عيّن رمزي" : "Set my PIN"}
            </Button>
          </div>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-3" autoComplete="off">
            <div className="grid gap-3 sm:grid-cols-3">
              {hasPin && (
                <PinField label={isAr ? "الرمز الحالي" : "Current PIN"} value={currentPin} onChange={(v) => setCurrentPin(digits(v))} className={pinInputClass} />
              )}
              <PinField label={isAr ? "الرمز الجديد" : "New PIN"} value={pin} onChange={(v) => setPin(digits(v))} className={pinInputClass} />
              <PinField label={isAr ? "أعد كتابته" : "Repeat it"} value={confirmPin} onChange={(v) => setConfirmPin(digits(v))} className={pinInputClass} />
            </div>
            <InlineError error={error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" variant="brand" size="sm" loading={busy}>
                {hasPin ? (isAr ? "احفظ الرمز الجديد" : "Save new PIN") : isAr ? "عيّن الرمز" : "Set PIN"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </SectionCard>
  );
}

function PinField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="password"
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        required
      />
    </div>
  );
}
