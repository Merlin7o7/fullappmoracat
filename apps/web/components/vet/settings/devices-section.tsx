"use client";

/**
 * Counter devices (MRC-VET-001 §02 "Counter Mode — the shared-device answer").
 *
 * A PIN is only an acceptable identity switch on a device a manager vouched
 * for, so registration is a deliberate act from a personal session — and it
 * registers THIS browser: the id the API issues is adopted locally
 * (`setVetDeviceId`), which is what the counter unlock sends. Before this, the
 * portal sent a random local UUID the server had never seen, so Counter Mode
 * could not unlock anywhere.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorSmartphone, Plus, Tablet } from "lucide-react";
import { Badge, Button, Input, Skeleton, cn, useToast } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDateTime } from "@/lib/datetime";
import { getVetDeviceId, setVetDeviceId, useVetActor, useVetFetch } from "@/lib/vet-api";
import { SelectField } from "@/components/field";
import { EmptyState, SectionCard } from "@/components/vet/vet-shell-bits";
import { ConfirmDialog, InlineError } from "./confirm-dialog";
import { settingsError } from "./errors";
import type { CounterDevice, RegisteredDevice } from "./types";
import { useBranches } from "./branches-section";
import { useInvalidateOnboarding } from "./use-onboarding";

type Friendly = { title: string; message: string } | null;

export function DevicesSection() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const { toast } = useToast();
  const qc = useQueryClient();
  const vetFetch = useVetFetch();
  const { orgId } = useVetActor();
  const invalidateOnboarding = useInvalidateOnboarding();
  const branches = useBranches();

  const devicesKey = React.useMemo(() => ["vet", "org", "devices", orgId] as const, [orgId]);
  const devices = useQuery({
    queryKey: devicesKey,
    queryFn: () => vetFetch<{ items: CounterDevice[] }>("/vet/org/devices"),
    enabled: !!orgId,
  });

  // Which registered terminal (if any) this browser is. Read after mount — the
  // id lives in localStorage and must never be read during SSR.
  const [localId, setLocalId] = React.useState<string | null>(null);
  React.useEffect(() => setLocalId(getVetDeviceId() || null), []);

  const activeBranches = React.useMemo(
    () => (branches.data?.items ?? []).filter((b) => b.isActive),
    [branches.data],
  );
  const [formOpen, setFormOpen] = React.useState(false);
  const [branchId, setBranchId] = React.useState("");
  const [name, setName] = React.useState("");
  const [registering, setRegistering] = React.useState(false);
  const [formError, setFormError] = React.useState<Friendly>(null);

  const [revokeTarget, setRevokeTarget] = React.useState<CounterDevice | null>(null);
  const [revoking, setRevoking] = React.useState(false);
  const [revokeError, setRevokeError] = React.useState<Friendly>(null);

  React.useEffect(() => {
    const first = activeBranches[0];
    if (!branchId && first) setBranchId(first.id);
  }, [activeBranches, branchId]);
  React.useEffect(() => {
    if (!name) setName(isAr ? "آيباد الاستقبال" : "Reception iPad");
    // Only seed once — never overwrite what someone typed on a language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = devices.data?.items ?? [];
  const thisDevice = items.find((d) => d.id === localId && d.active) ?? null;
  const sorted = [...items].sort((a, b) => Number(b.active) - Number(a.active));

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!branchId) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setFormError(
        isAr
          ? { title: "سمِّ الجهاز", message: "اسم قصير يميّزه، مثل «آيباد الاستقبال — العليا»." }
          : { title: "Name the device", message: "A short name that tells it apart, like “Reception iPad — Olaya”." },
      );
      return;
    }
    setRegistering(true);
    try {
      const device = await vetFetch<RegisteredDevice>(
        `/vet/org/branches/${encodeURIComponent(branchId)}/devices`,
        { method: "POST", body: JSON.stringify({ name: trimmed }) },
      );
      setVetDeviceId(device.id);
      setLocalId(device.id);
      setFormOpen(false);
      void qc.invalidateQueries({ queryKey: devicesKey });
      void invalidateOnboarding();
      toast({
        title: isAr ? "صار هذا الجهاز كاونتراً" : "This device is now a counter",
        description: isAr
          ? "كل زميل يفتحه برقم الموظف ورمزه السري من زر «وضع الكاونتر»."
          : "Each colleague unlocks it with their staff number and PIN from “Counter mode”.",
        variant: "success",
      });
    } catch (err) {
      setFormError(settingsError(err, isAr));
    } finally {
      setRegistering(false);
    }
  }

  async function revoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await vetFetch(`/vet/org/devices/${encodeURIComponent(revokeTarget.id)}/revoke`, {
        method: "POST",
        body: "{}",
      });
      if (revokeTarget.id === localId) {
        setVetDeviceId(null);
        setLocalId(null);
      }
      setRevokeTarget(null);
      void qc.invalidateQueries({ queryKey: devicesKey });
      void invalidateOnboarding();
      toast({
        title: isAr ? "أُلغي تسجيل الجهاز" : "Device revoked",
        description: isAr
          ? "انتهت كل جلسات الكاونتر المفتوحة عليه."
          : "Every counter session open on it has ended.",
        variant: "success",
      });
    } catch (err) {
      setRevokeError(settingsError(err, isAr));
    } finally {
      setRevoking(false);
    }
  }

  const branchName = (b: { nameAr: string; nameEn: string }) => (isAr ? b.nameAr || b.nameEn : b.nameEn || b.nameAr);

  return (
    <SectionCard
      title={isAr ? "أجهزة الكاونتر" : "Counter devices"}
      hint={
        isAr
          ? "الأجهزة المشتركة عند الاستقبال — كل زميل يفتحها برمزه، وكل إجراء يُنسب له."
          : "Shared front-desk devices — each colleague unlocks with their own PIN, and every action is theirs."
      }
      icon={Tablet}
      action={
        !thisDevice && !formOpen && activeBranches.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">{isAr ? "سجّل هذا الجهاز" : "Register this device"}</span>
            <span className="sm:hidden">{isAr ? "تسجيل" : "Register"}</span>
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        {formOpen && (
          <form onSubmit={register} className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
            <div>
              <p className="text-sm font-medium">
                {isAr ? "سجّل هذا الجهاز ككاونتر" : "Register this device as a counter"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {isAr
                  ? "افعل هذا من الجهاز الموجود عند الاستقبال نفسه — التسجيل يخص هذا المتصفح على هذا الجهاز."
                  : "Do this on the front-desk device itself — registration belongs to this browser on this device."}
              </p>
            </div>
            {activeBranches.length > 1 && (
              <SelectField
                label={isAr ? "الفرع" : "Branch"}
                value={branchId}
                onChange={setBranchId}
                required
                options={activeBranches.map((b) => ({ value: b.id, label: branchName(b) }))}
              />
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="device-name" className="text-sm font-medium">
                {isAr ? "اسم الجهاز" : "Device name"}
              </label>
              <Input
                id="device-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 80))}
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground">
                {isAr ? "مثل «آيباد الاستقبال — العليا»." : "For example “Reception iPad — Olaya”."}
              </p>
            </div>
            <InlineError error={formError} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={registering}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" variant="brand" size="sm" loading={registering}>
                {isAr ? "سجّل الجهاز" : "Register device"}
              </Button>
            </div>
          </form>
        )}

        {devices.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : devices.isError ? (
          <EmptyState
            icon={Tablet}
            title={settingsError(devices.error, isAr).title}
            body={settingsError(devices.error, isAr).message}
            action={
              <Button size="sm" variant="outline" onClick={() => void devices.refetch()} loading={devices.isFetching}>
                {isAr ? "أعد المحاولة" : "Try again"}
              </Button>
            }
          />
        ) : items.length === 0 ? (
          !formOpen && (
            <EmptyState
              icon={MonitorSmartphone}
              title={isAr ? "لا يوجد كاونتر مسجّل بعد" : "No counter registered yet"}
              body={
                isAr
                  ? "افتح هذه الصفحة على جهاز الاستقبال وسجّله — بعدها يبدّل كل زميل هويته برمزه خلال ثانيتين."
                  : "Open this page on the front-desk device and register it — then each colleague switches in with their PIN in two seconds."
              }
              action={
                activeBranches.length > 0 ? (
                  <Button size="sm" variant="brand" onClick={() => setFormOpen(true)}>
                    <Plus className="size-4" aria-hidden />
                    {isAr ? "سجّل هذا الجهاز" : "Register this device"}
                  </Button>
                ) : null
              }
            />
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((d) => {
              const isThis = d.id === localId && d.active;
              return (
                <li
                  key={d.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                    isThis ? "border-primary/40 bg-primary/[0.05]" : "border-border",
                    !d.active && "opacity-60",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground" aria-hidden>
                      <Tablet className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{d.name}</span>
                        {isThis && <Badge variant="default">{isAr ? "هذا الجهاز" : "This device"}</Badge>}
                        {!d.active && <Badge variant="secondary">{isAr ? "ملغى" : "Revoked"}</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {branchName(d.branch)}
                        {" · "}
                        {d.lastSeenAt
                          ? isAr
                            ? `آخر استخدام ${formatDateTime(d.lastSeenAt, loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                            : `Last used ${formatDateTime(d.lastSeenAt, loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : isAr
                            ? "لم يُستخدم بعد"
                            : "Not used yet"}
                      </p>
                    </div>
                  </div>
                  {d.active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setRevokeError(null);
                        setRevokeTarget(d);
                      }}
                    >
                      {isAr ? "إلغاء التسجيل" : "Revoke"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => void revoke()}
        busy={revoking}
        error={revokeError}
        destructive
        title={isAr ? `إلغاء تسجيل «${revokeTarget?.name ?? ""}»؟` : `Revoke “${revokeTarget?.name ?? ""}”?`}
        description={
          isAr
            ? "يتوقف وضع الكاونتر على هذا الجهاز فوراً وتنتهي أي جلسة مفتوحة عليه. يمكنك تسجيله من جديد لاحقاً."
            : "Counter mode stops on this device immediately and any open session on it ends. You can register it again later."
        }
        confirmLabel={isAr ? "ألغِ التسجيل" : "Revoke device"}
        cancelLabel={isAr ? "تراجع" : "Keep it"}
      />
    </SectionCard>
  );
}
