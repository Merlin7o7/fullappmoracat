"use client";

/**
 * The clinic team (MRC-VET-001 §02/§14). The governing idea: an individual
 * account must be CHEAPER than a shared one, so inviting a colleague is a
 * twenty-second act, and every destructive action is reversible-by-design,
 * confirmed without trapping (R116) and audited. Nobody hands out a role above
 * their own — the role picker renders exactly what the API says is assignable.
 */

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, MailPlus, RotateCw, UserPlus, Users } from "lucide-react";
import { Badge, Button, Input, Skeleton, cn, useToast } from "@moraqat/ui";
import type { VetRole } from "@moraqat/core";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { useVetActor, useVetFetch } from "@/lib/vet-api";
import { SelectField } from "@/components/field";
import { EmptyState, SectionCard } from "@/components/vet/vet-shell-bits";
import { ConfirmDialog, InlineError } from "./confirm-dialog";
import { settingsError } from "./errors";
import type { AssignableRoles, PendingInvite, StaffList, StaffRow, StaffStatus } from "./types";
import { useInvalidateOnboarding } from "./use-onboarding";

type Friendly = { title: string; message: string } | null;
type StaffAction = "suspend" | "reactivate" | "offboard" | "pin-reset";
type Pending =
  | { kind: "staff"; action: StaffAction; staff: StaffRow }
  | { kind: "invite-revoke"; invite: PendingInvite };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TeamSection() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const loc = isAr ? "ar" : "en";
  const { toast } = useToast();
  const qc = useQueryClient();
  const vetFetch = useVetFetch();
  const { orgId } = useVetActor();
  const invalidateOnboarding = useInvalidateOnboarding();

  const staffKey = React.useMemo(() => ["vet", "staff", orgId] as const, [orgId]);
  const invitesKey = React.useMemo(() => ["vet", "staff", "invites", orgId] as const, [orgId]);

  const staff = useQuery({
    queryKey: staffKey,
    queryFn: () => vetFetch<StaffList>("/vet/staff?limit=100"),
    enabled: !!orgId,
  });
  const invites = useQuery({
    queryKey: invitesKey,
    queryFn: () => vetFetch<{ items: PendingInvite[] }>("/vet/staff/invites"),
    enabled: !!orgId,
  });
  const assignable = useQuery({
    queryKey: ["vet", "staff", "assignable", orgId],
    queryFn: () => vetFetch<AssignableRoles>("/vet/staff/assignable-roles"),
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
  const roles = React.useMemo(() => assignable.data?.roles ?? [], [assignable.data]);
  const canAssign = (role: VetRole) => roles.some((r) => r.role === role);

  const refreshAll = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: staffKey });
    void qc.invalidateQueries({ queryKey: invitesKey });
    void invalidateOnboarding();
  }, [qc, staffKey, invitesKey, invalidateOnboarding]);

  /* ── Invite form ─────────────────────────────────────────────────────── */
  const [formOpen, setFormOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<string>("");
  const [title, setTitle] = React.useState("");
  const [inviting, setInviting] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<Friendly>(null);

  React.useEffect(() => {
    // Default to the most common hire, never to the most powerful role.
    const fallback = roles.find((r) => r.role === "VET") ?? roles[roles.length - 1];
    if (!role && fallback) setRole(fallback.role);
  }, [roles, role]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) {
      setInviteError(
        isAr
          ? { title: "تحقّق من البريد", message: "اكتب بريد الزميل كاملاً، مثل name@clinic.sa." }
          : { title: "Check the email", message: "Enter your colleague's full email, like name@clinic.sa." },
      );
      return;
    }
    if (!role) return;
    setInviting(true);
    try {
      await vetFetch("/vet/staff/invites", {
        method: "POST",
        body: JSON.stringify({ email: address, role, ...(title.trim() ? { title: title.trim() } : {}) }),
      });
      setEmail("");
      setTitle("");
      setFormOpen(false);
      refreshAll();
      toast({
        title: isAr ? "أُرسلت الدعوة" : "Invitation sent",
        description: isAr
          ? `يصل الرابط إلى ${address} ويبقى صالحاً ٧ أيام.`
          : `The link is on its way to ${address} and stays valid for 7 days.`,
        variant: "success",
      });
    } catch (err) {
      setInviteError(settingsError(err, isAr));
    } finally {
      setInviting(false);
    }
  }

  /* ── Confirmed actions ───────────────────────────────────────────────── */
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [acting, setActing] = React.useState(false);
  const [actionError, setActionError] = React.useState<Friendly>(null);

  async function runPending(reason: string) {
    if (!pending) return;
    setActing(true);
    setActionError(null);
    try {
      if (pending.kind === "invite-revoke") {
        await vetFetch(`/vet/staff/invites/${encodeURIComponent(pending.invite.id)}/revoke`, { method: "POST", body: "{}" });
      } else {
        const id = encodeURIComponent(pending.staff.id);
        const path =
          pending.action === "pin-reset" ? `/vet/staff/${id}/pin/reset` : `/vet/staff/${id}/${pending.action}`;
        const body =
          pending.action === "suspend" || pending.action === "offboard" ? { ...(reason ? { reason } : {}) } : {};
        await vetFetch(path, { method: "POST", body: JSON.stringify(body) });
      }
      toast({ title: doneCopy(pending, isAr), variant: "success" });
      setPending(null);
      refreshAll();
    } catch (err) {
      setActionError(settingsError(err, isAr));
    } finally {
      setActing(false);
    }
  }

  const [resending, setResending] = React.useState<string | null>(null);
  async function resend(invite: PendingInvite) {
    setResending(invite.id);
    try {
      await vetFetch(`/vet/staff/invites/${encodeURIComponent(invite.id)}/resend`, { method: "POST", body: "{}" });
      refreshAll();
      toast({
        title: isAr ? "أُرسل رابط جديد" : "A fresh link is on its way",
        description: isAr ? "الرابط السابق توقف عن العمل." : "The previous link no longer works.",
        variant: "success",
      });
    } catch (err) {
      const f = settingsError(err, isAr);
      toast({ title: f.title, description: f.message, variant: "error" });
    } finally {
      setResending(null);
    }
  }

  const people = [...(staff.data?.items ?? [])].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );
  const openInvites = invites.data?.items ?? [];
  const justMe = people.filter((p) => p.status !== "OFFBOARDED").length <= 1 && openInvites.length === 0;

  const inviteForm = (
    <form onSubmit={sendInvite} className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
      <p className="text-sm font-medium">{isAr ? "ادعُ زميلاً" : "Invite a teammate"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-email" className="text-sm font-medium">
            {isAr ? "البريد الإلكتروني" : "Email"}
            <span className="ms-0.5 text-destructive" aria-hidden>
              *
            </span>
          </label>
          <Input
            id="invite-email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@clinic.sa"
            className="text-start"
            required
          />
        </div>
        {roles.length > 0 && (
          <SelectField
            label={isAr ? "الدور" : "Role"}
            value={role}
            onChange={setRole}
            required
            options={roles.map((r) => ({ value: r.role, label: isAr ? r.label.ar : r.label.en }))}
          />
        )}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="invite-title" className="text-sm font-medium">
            {isAr ? "اللقب (اختياري)" : "Title (optional)"}
          </label>
          <Input
            id="invite-title"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder={isAr ? "د." : "Dr."}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "يظهر بجانب اسمه على ما يكتبه في السجلات. الوصول لكل الفروع."
              : "Shown beside their name on what they write. Access covers every branch."}
          </p>
        </div>
      </div>
      <InlineError error={inviteError} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={inviting} onClick={() => setFormOpen(false)}>
          {isAr ? "إلغاء" : "Cancel"}
        </Button>
        <Button type="submit" size="sm" variant="brand" loading={inviting} disabled={!role}>
          <MailPlus className="size-4" aria-hidden />
          {isAr ? "أرسل الدعوة" : "Send invitation"}
        </Button>
      </div>
    </form>
  );

  return (
    <SectionCard
      title={isAr ? "الفريق" : "Team"}
      hint={
        isAr
          ? "لكل زميل دخول باسمه — لأن كل ما يُكتب في السجل يُنسب لشخص."
          : "Everyone signs in as themselves — everything written in a record belongs to a person."
      }
      icon={Users}
      action={
        !formOpen && roles.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            <span className="hidden sm:inline">{isAr ? "ادعُ زميلاً" : "Invite teammate"}</span>
            <span className="sm:hidden">{isAr ? "دعوة" : "Invite"}</span>
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {formOpen && inviteForm}

        {staff.isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : staff.isError ? (
          <EmptyState
            icon={Users}
            title={settingsError(staff.error, isAr).title}
            body={settingsError(staff.error, isAr).message}
            action={
              <Button size="sm" variant="outline" onClick={() => void staff.refetch()} loading={staff.isFetching}>
                {isAr ? "أعد المحاولة" : "Try again"}
              </Button>
            }
          />
        ) : (
          <>
            {justMe && !formOpen && (
              <EmptyState
                icon={UserPlus}
                title={isAr ? "أنت وحدك حتى الآن" : "It's just you so far"}
                body={
                  isAr
                    ? "لكل زميل دخول خاص به — تأخذ الدعوة عشرين ثانية."
                    : "Colleagues get their own sign-in — an invitation takes twenty seconds."
                }
                action={
                  roles.length > 0 ? (
                    <Button size="sm" variant="brand" onClick={() => setFormOpen(true)}>
                      <UserPlus className="size-4" aria-hidden />
                      {isAr ? "ادعُ زميلاً" : "Invite a teammate"}
                    </Button>
                  ) : null
                }
              />
            )}

            <ul className="flex flex-col gap-2">
              {people.map((p) => {
                const manageable = !p.isSelf && canAssign(p.role);
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5",
                      p.status === "OFFBOARDED" && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">
                          {[p.title, p.user.name].filter(Boolean).join(" ") || p.user.email}
                        </span>
                        {p.isSelf && <Badge variant="default">{isAr ? "أنت" : "You"}</Badge>}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span dir="ltr" className="truncate">
                          {p.user.email}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{isAr ? p.roleLabel.ar : p.roleLabel.en}</span>
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge variant={STATUS_BADGE[p.status]} dot>
                          {statusLabel(p.status, isAr)}
                        </Badge>
                        {p.status === "ACTIVE" && (
                          <Badge variant={p.hasCounterPin ? "secondary" : "outline"}>
                            <KeyRound className="size-3" aria-hidden />
                            {p.hasCounterPin ? (isAr ? "الرمز معيّن" : "PIN set") : isAr ? "بلا رمز" : "No PIN"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {manageable && p.status !== "OFFBOARDED" && p.status !== "INVITED" && (
                      <div className="flex flex-wrap gap-1">
                        {p.hasCounterPin && (
                          <ActionButton onClick={() => ask({ kind: "staff", action: "pin-reset", staff: p })}>
                            {isAr ? "امسح الرمز" : "Clear PIN"}
                          </ActionButton>
                        )}
                        {p.status === "ACTIVE" ? (
                          <ActionButton onClick={() => ask({ kind: "staff", action: "suspend", staff: p })}>
                            {isAr ? "إيقاف" : "Suspend"}
                          </ActionButton>
                        ) : (
                          <ActionButton onClick={() => ask({ kind: "staff", action: "reactivate", staff: p })}>
                            {isAr ? "إعادة التفعيل" : "Reactivate"}
                          </ActionButton>
                        )}
                        <ActionButton destructive onClick={() => ask({ kind: "staff", action: "offboard", staff: p })}>
                          {isAr ? "إنهاء الوصول" : "Offboard"}
                        </ActionButton>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {/* ── Invitations still waiting ── */}
        {openInvites.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {isAr ? "دعوات بانتظار القبول" : "Invitations waiting"}
            </p>
            <ul className="flex flex-col gap-2">
              {openInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inv.fullName || <span dir="ltr">{inv.email}</span>}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {inv.fullName && (
                        <>
                          <span dir="ltr" className="truncate">
                            {inv.email}
                          </span>
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <span>{isAr ? inv.roleLabel.ar : inv.roleLabel.en}</span>
                      <span aria-hidden>·</span>
                      {inv.expired ? (
                        <span className="font-medium text-[hsl(38_92%_26%)] dark:text-warning">
                          {isAr ? "انتهت صلاحيتها" : "Expired"}
                        </span>
                      ) : (
                        <span>
                          {isAr ? `صالحة حتى ${formatDate(inv.expiresAt, loc)}` : `Valid until ${formatDate(inv.expiresAt, loc)}`}
                        </span>
                      )}
                    </p>
                  </div>
                  {canAssign(inv.role) && (
                    <div className="flex flex-wrap gap-1">
                      <ActionButton onClick={() => void resend(inv)} loading={resending === inv.id}>
                        <RotateCw className="size-3.5" aria-hidden />
                        {isAr ? "أعد الإرسال" : "Resend"}
                      </ActionButton>
                      <ActionButton destructive onClick={() => ask({ kind: "invite-revoke", invite: inv })}>
                        {isAr ? "إلغاء الدعوة" : "Revoke"}
                      </ActionButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {pending && (
        <ConfirmDialog
          open
          onClose={() => setPending(null)}
          onConfirm={(reason) => void runPending(reason)}
          busy={acting}
          error={actionError}
          destructive={pending.kind === "invite-revoke" || pending.action === "offboard" || pending.action === "suspend"}
          {...confirmCopy(pending, isAr)}
        />
      )}
    </SectionCard>
  );

  function ask(next: Pending) {
    setActionError(null);
    setPending(next);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */

const STATUS_ORDER: Record<StaffStatus, number> = { ACTIVE: 0, INVITED: 1, SUSPENDED: 2, OFFBOARDED: 3 };
const STATUS_BADGE: Record<StaffStatus, "success" | "info" | "warning" | "secondary"> = {
  ACTIVE: "success",
  INVITED: "info",
  SUSPENDED: "warning",
  OFFBOARDED: "secondary",
};

function statusLabel(s: StaffStatus, isAr: boolean): string {
  switch (s) {
    case "ACTIVE":
      return isAr ? "نشط" : "Active";
    case "INVITED":
      return isAr ? "بانتظار القبول" : "Invited";
    case "SUSPENDED":
      return isAr ? "موقوف" : "Suspended";
    default:
      return isAr ? "انتهى وصوله" : "Offboarded";
  }
}

function ActionButton({
  children,
  onClick,
  destructive,
  loading,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={loading}
      onClick={onClick}
      className={cn("px-3", destructive && "text-destructive hover:bg-destructive/10")}
    >
      {children}
    </Button>
  );
}

function personName(p: StaffRow): string {
  return p.user.name || p.user.email;
}

function confirmCopy(
  p: Pending,
  isAr: boolean,
): { title: string; description: string; confirmLabel: string; cancelLabel: string; reasonLabel?: string; reasonHint?: string } {
  const cancelLabel = isAr ? "تراجع" : "Go back";
  const reasonLabel = isAr ? "السبب (اختياري)" : "Reason (optional)";
  const reasonHint = isAr ? "يُحفظ في سجل التدقيق، ولا يراه الزميل." : "Kept in the audit trail; your colleague doesn't see it.";
  if (p.kind === "invite-revoke") {
    return {
      title: isAr ? "إلغاء الدعوة؟" : "Revoke this invitation?",
      description: isAr
        ? `يتوقف رابط الدعوة المرسل إلى ${p.invite.email} فوراً. يمكنك دعوته من جديد لاحقاً.`
        : `The link sent to ${p.invite.email} stops working immediately. You can invite them again later.`,
      confirmLabel: isAr ? "ألغِ الدعوة" : "Revoke invitation",
      cancelLabel,
    };
  }
  const name = personName(p.staff);
  switch (p.action) {
    case "suspend":
      return {
        title: isAr ? `إيقاف ${name}؟` : `Suspend ${name}?`,
        description: isAr
          ? "يتوقف دخوله لهذه العيادة وتنتهي جلسات الكاونتر المفتوحة باسمه. الإيقاف قابل للتراجع في أي وقت."
          : "Their access to this clinic pauses and any counter session in their name ends. You can reactivate them any time.",
        confirmLabel: isAr ? "أوقف الوصول" : "Suspend access",
        cancelLabel,
        reasonLabel,
        reasonHint,
      };
    case "reactivate":
      return {
        title: isAr ? `إعادة تفعيل ${name}؟` : `Reactivate ${name}?`,
        description: isAr
          ? "يعود دخوله للعيادة بالدور نفسه الذي كان عليه."
          : "Their access to the clinic returns, with the same role as before.",
        confirmLabel: isAr ? "أعد التفعيل" : "Reactivate",
        cancelLabel,
      };
    case "offboard":
      return {
        title: isAr ? `إنهاء وصول ${name}؟` : `Offboard ${name}?`,
        description: isAr
          ? "يُغلق كل باب: الدخول، والجلسات، والرمز السري. ويبقى اسمه على ما كتبه، لأن السجل الطبي لا يُيتَّم."
          : "Every door closes: sign-in, sessions and PIN. Their name stays on what they wrote, because a medical record is never orphaned.",
        confirmLabel: isAr ? "أنهِ الوصول" : "Offboard",
        cancelLabel,
        reasonLabel,
        reasonHint,
      };
    default:
      return {
        title: isAr ? `مسح رمز ${name}؟` : `Clear ${name}'s PIN?`,
        description: isAr
          ? "لن يفتح الكاونتر برمزه القديم، ويعيّن رمزاً جديداً من حسابه. لا أحد غيره يعرف الرمز الجديد."
          : "Their old PIN stops unlocking the counter, and they set a new one from their own account. Nobody else ever knows it.",
        confirmLabel: isAr ? "امسح الرمز" : "Clear PIN",
        cancelLabel,
      };
  }
}

function doneCopy(p: Pending, isAr: boolean): string {
  if (p.kind === "invite-revoke") return isAr ? "أُلغيت الدعوة" : "Invitation revoked";
  switch (p.action) {
    case "suspend":
      return isAr ? "أُوقف الوصول" : "Access suspended";
    case "reactivate":
      return isAr ? "أُعيد التفعيل" : "Access restored";
    case "offboard":
      return isAr ? "انتهى الوصول" : "Offboarded";
    default:
      return isAr ? "مُسح الرمز السري" : "PIN cleared";
  }
}
