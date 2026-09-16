"use client";

/**
 * Step 5 — who else needs an account. Nobody is emailed while the owner is
 * still typing: invitations go out the moment the registration is submitted,
 * and colleagues can set up their accounts while Moracat reviews — they just
 * can't open member records until the clinic is approved and live.
 */

import * as React from "react";
import { Plus, Stethoscope, Trash2, UserRound } from "lucide-react";
import { Button, Card, cn } from "@moraqat/ui";
import {
  REGISTRATION_STEPS,
  REGISTRATION_TEAM_ROLES,
  VET_ROLE_LABELS,
  isDoctorRole,
  normalizeSaudiMobile,
  asciiDigits,
  type VetRole,
} from "@moraqat/core";
import {
  registrationError,
  toDateInput,
  type RegFriendlyError,
  type OwnerPractiseInput,
  type RegistrationState,
  type TeamMemberInput,
} from "@/lib/vet-registration";
import {
  ActionBar,
  EMAIL_RE,
  ErrorNote,
  Notice,
  RestoredDraftNote,
  SelectField,
  StepHeader,
  SwitchRow,
  TextField,
  focusFirstError,
} from "./ui";
import { draftKey, useDraft } from "./use-draft";
import type { StepProps } from "./types";

interface MemberForm {
  key: string;
  fullName: string;
  email: string;
  phone: string;
  role: VetRole;
  title: string;
  licenceNo: string;
  licenceExpiresAt: string;
  branchIds: string[];
}

const newKey = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function blankMember(role: VetRole = "VET"): MemberForm {
  return { key: newKey(), fullName: "", email: "", phone: "", role, title: "", licenceNo: "", licenceExpiresAt: "", branchIds: [] };
}

interface OwnerForm {
  practisesAsVet: boolean;
  title: string;
  licenceNo: string;
  licenceExpiresAt: string;
}

interface TeamDraft {
  owner: OwnerForm;
  members: MemberForm[];
}

function fromState(s: RegistrationState): TeamDraft {
  const owner: OwnerForm = {
    practisesAsVet: !!s.owner?.practisesAsVet,
    title: s.owner?.title ?? "",
    licenceNo: s.owner?.licenceNo ?? "",
    licenceExpiresAt: toDateInput(s.owner?.licenceExpiresAt),
  };
  // A solo vet-owner may have nobody else to list — don't hand them an empty row to delete.
  if (!s.team.length) return { owner, members: owner.practisesAsVet ? [] : [blankMember("VET")] };
  return { owner, members: membersFromState(s) };
}

function ownerLicenceError(o: OwnerForm, isAr: boolean): string | undefined {
  if (!o.practisesAsVet || o.licenceNo.trim().length >= 2) return undefined;
  return isAr ? "أدخل رقم ترخيص مزاولة المهنة الخاص بك." : "Enter your own practitioner licence number.";
}

function ownerToInput(o: OwnerForm): OwnerPractiseInput {
  // false clears the owner's licence on the API — nothing else to send.
  if (!o.practisesAsVet) return { ownerPractisesAsVet: false };
  return {
    ownerPractisesAsVet: true,
    ownerLicenceNo: o.licenceNo.trim() || undefined,
    ownerLicenceExpiresAt: o.licenceExpiresAt || undefined,
    ownerTitle: o.title.trim() || undefined,
  };
}

function membersFromState(s: RegistrationState): MemberForm[] {
  return s.team.map((m) => ({
    key: newKey(),
    fullName: m.fullName,
    email: m.email,
    phone: m.phone,
    role: m.role,
    title: m.title ?? "",
    licenceNo: m.licenceNo ?? "",
    licenceExpiresAt: toDateInput(m.licenceExpiresAt),
    branchIds: m.branchIds ?? [],
  }));
}

type MemberErrors = Partial<Record<keyof MemberForm, string>>;

function validateMember(m: MemberForm, all: MemberForm[], ownerEmail: string | null, isAr: boolean): MemberErrors {
  const e: MemberErrors = {};
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const email = m.email.trim().toLowerCase();
  if (m.fullName.trim().length < 2) e.fullName = t("اكتب الاسم الكامل.", "Enter their full name.");
  if (!EMAIL_RE.test(email)) e.email = t("اكتب بريداً صحيحاً — عليه تصل الدعوة.", "Enter a valid email — the invitation goes there.");
  else if (ownerEmail && email === ownerEmail.toLowerCase())
    e.email = t("هذا بريدك أنت — أنت ضمن الفريق بصفتك المالك.", "That's your own email — you're already on the team as the owner.");
  else if (all.filter((x) => x.email.trim().toLowerCase() === email).length > 1)
    e.email = t("هذا البريد مكرر — لكل شخص بريد مختلف.", "This email is listed twice — each person needs their own.");
  if (!normalizeSaudiMobile(m.phone)) e.phone = t("اكتب رقم جوال سعودي مثل 05XXXXXXXX.", "Enter a Saudi mobile like 05XXXXXXXX.");
  if (isDoctorRole(m.role) && m.licenceNo.trim().length < 2)
    e.licenceNo = t("رقم ترخيص مزاولة المهنة مطلوب للأطباء.", "Doctors need a practitioner licence number.");
  return e;
}

function toInput(m: MemberForm): TeamMemberInput {
  const doctor = isDoctorRole(m.role);
  return {
    fullName: m.fullName.trim(),
    email: m.email.trim().toLowerCase(),
    phone: normalizeSaudiMobile(m.phone) ?? m.phone.trim(),
    role: m.role,
    title: m.title.trim() || undefined,
    licenceNo: doctor ? m.licenceNo.trim() || undefined : undefined,
    licenceExpiresAt: doctor ? m.licenceExpiresAt || undefined : undefined,
    branchIds: m.branchIds,
  };
}

export function StepTeam({ orgId, state, api, isAr, onState, onNext, onBack }: StepProps) {
  // v2 key: drafts from before the owner toggle were a bare member array (R117 without crashing).
  const draft = useDraft<TeamDraft>(draftKey(orgId, "team.v2"), () => fromState(state));
  const { owner, members } = draft.value;
  const [attempted, setAttempted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<RegFriendlyError | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const meta = REGISTRATION_STEPS.find((s) => s.key === "team")!;
  const ownerEmail = state.owner?.email ?? null;

  const hasDoctor = owner.practisesAsVet || members.some((m) => isDoctorRole(m.role));
  const ownerErr = attempted ? ownerLicenceError(owner, isAr) : undefined;
  const setMembers = (fn: (prev: MemberForm[]) => MemberForm[]) =>
    draft.set((prev) => ({ ...prev, members: fn(prev.members) }));
  const setOwner = (patch: Partial<OwnerForm>) =>
    draft.set((prev) => ({ ...prev, owner: { ...prev.owner, ...patch } }));
  const update = (key: string, patch: Partial<MemberForm>) =>
    setMembers((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setError(null);
    const invalid = members.some((m) => Object.keys(validateMember(m, members, ownerEmail, isAr)).length);
    if (invalid || !hasDoctor || ownerLicenceError(owner, isAr)) {
      focusFirstError(formRef.current);
      return;
    }
    setBusy(true);
    try {
      const next = await api.saveTeam(orgId, members.map(toInput), ownerToInput(owner));
      draft.reset(fromState(next));
      onState(next);
      onNext();
    } catch (err) {
      setError(registrationError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={save} noValidate className="flex flex-col gap-5">
      <StepHeader title={isAr ? meta.ar : meta.en} hint={isAr ? meta.hintAr : meta.hintEn} />
      {draft.restored && <RestoredDraftNote isAr={isAr} onDiscard={() => draft.reset(fromState(state))} />}

      <Notice tone="info" title={isAr ? "متى تصلهم الدعوة؟" : "When do they get invited?"}>
        {isAr
          ? "لا نرسل شيئاً الآن. لحظة إرسال الطلب يصل كل شخص هنا بريد دعوة لإنشاء حسابه. يستطيعون تجهيز حساباتهم أثناء المراجعة، لكن سجلات الأعضاء لا تُفتح إلا بعد قبول العيادة وتفعيلها. أنت مضاف تلقائياً بصفتك المالك — لا تضف نفسك."
          : "Nothing is sent yet. The moment you submit, everyone listed here gets an email invitation to create their account. They can set up while we review, but member records only open once the clinic is approved and live. You're already on the team as the owner — don't add yourself."}
      </Notice>

      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <SwitchRow
          label={isAr ? "أنا طبيب بيطري وأمارس في العيادة" : "I'm a veterinarian and practise at this clinic"}
          description={
            isAr
              ? "فعّلها إن كنت تعالج بنفسك — يُحتسب ترخيصك طبيبَ العيادة، دون إضافة نفسك للفريق."
              : "Turn this on if you treat patients yourself — your licence counts as the clinic's vet, without adding yourself below."
          }
          checked={owner.practisesAsVet}
          onChange={(v) => setOwner({ practisesAsVet: v })}
        />
        {owner.practisesAsVet && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              isAr={isAr}
              label={isAr ? "اللقب" : "Title"}
              hint={isAr ? "مثل: د." : "e.g. Dr."}
              value={owner.title}
              onChange={(v) => setOwner({ title: v })}
              optional
              maxLength={60}
            />
            <TextField
              isAr={isAr}
              label={isAr ? "رقم ترخيص مزاولة المهنة" : "Practitioner licence number"}
              value={owner.licenceNo}
              onChange={(v) => setOwner({ licenceNo: asciiDigits(v) })}
              error={ownerErr}
              required
              dir="ltr"
              maxLength={60}
              inputClassName="tabular"
            />
            <TextField
              isAr={isAr}
              type="date"
              label={isAr ? "تاريخ انتهاء الترخيص" : "Licence expiry"}
              value={owner.licenceExpiresAt}
              onChange={(v) => setOwner({ licenceExpiresAt: v })}
              optional
              dir="ltr"
            />
          </div>
        )}
      </Card>

      <ul className="flex flex-col gap-4">
        {members.map((m, i) => (
          <li key={m.key}>
            <MemberCard
              index={i}
              member={m}
              isAr={isAr}
              branches={state.branches.map((b) => ({ id: b.id, name: isAr ? b.nameAr : b.nameEn || b.nameAr }))}
              errors={attempted ? validateMember(m, members, ownerEmail, isAr) : {}}
              onChange={(patch) => update(m.key, patch)}
              onRemove={() => setMembers((prev) => prev.filter((x) => x.key !== m.key))}
            />
          </li>
        ))}
      </ul>

      {!hasDoctor && (
        <div
          role={attempted ? "alert" : undefined}
          data-invalid={attempted ? true : undefined}
          tabIndex={-1}
          className="outline-none"
        >
          <Notice tone="warning" title={isAr ? "أضف طبيباً بيطرياً واحداً على الأقل" : "Add at least one veterinarian"}>
            {isAr
              ? "العيادة الشريكة تكتب سجلات طبية، والسجل الطبي لا يوقّعه إلا طبيب مرخّص. إن كنت تمارس المهنة بنفسك ففعّل الخيار في الأعلى، أو اختر لأحد الفريق دور «طبيب بيطري» أو «طبيب بيطري أول» أو «متدرب» مع رقم ترخيصه."
              : "A partner clinic writes medical records, and only a licensed vet can sign one. If you practise here yourself, turn on the option above — or give someone the Veterinarian, Senior veterinarian or Intern role with their licence number."}
          </Notice>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <AddButton onClick={() => setMembers((prev) => [...prev, blankMember("VET")])} icon={<Stethoscope className="size-4" aria-hidden />}>
          {isAr ? "أضف طبيباً" : "Add a vet"}
        </AddButton>
        <AddButton onClick={() => setMembers((prev) => [...prev, blankMember("RECEPTION")])} icon={<UserRound className="size-4" aria-hidden />}>
          {isAr ? "أضف موظفاً آخر" : "Add another team member"}
        </AddButton>
      </div>

      <ErrorNote error={error} />
      <ActionBar isAr={isAr} onBack={onBack} primaryType="submit" loading={busy} primaryLabel={isAr ? "حفظ ومتابعة" : "Save and continue"} />
    </form>
  );
}

function AddButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 text-sm font-medium text-muted-foreground transition-colors",
        "hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <Plus className="size-4" aria-hidden />
      {icon}
      {children}
    </button>
  );
}

function MemberCard({
  index,
  member: m,
  isAr,
  branches,
  errors,
  onChange,
  onRemove,
}: {
  index: number;
  member: MemberForm;
  isAr: boolean;
  branches: { id: string; name: string }[];
  errors: MemberErrors;
  onChange: (patch: Partial<MemberForm>) => void;
  onRemove: () => void;
}) {
  const doctor = isDoctorRole(m.role);
  const roleOptions = REGISTRATION_TEAM_ROLES.map((r) => ({ value: r, label: VET_ROLE_LABELS[r][isAr ? "ar" : "en"] }));
  const allBranches = m.branchIds.length === 0;
  const groupId = React.useId();

  const toggleBranch = (id: string, on: boolean) => {
    const set = new Set(m.branchIds);
    if (on) set.add(id);
    else set.delete(id);
    // Ticking every branch is the same as "all" — store it as empty so new branches are included too.
    const next = [...set];
    onChange({ branchIds: next.length === branches.length ? [] : next });
  };

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span
            className={cn(
              "grid size-8 place-items-center rounded-lg",
              doctor ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
            aria-hidden
          >
            {doctor ? <Stethoscope className="size-4" /> : <UserRound className="size-4" />}
          </span>
          {m.fullName.trim() || (isAr ? `عضو الفريق ${index + 1}` : `Team member ${index + 1}`)}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-destructive">
          <Trash2 aria-hidden />
          <span>{isAr ? "إزالة" : "Remove"}</span>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          isAr={isAr}
          label={isAr ? "الدور" : "Role"}
          value={m.role}
          onChange={(v) => onChange({ role: v as VetRole })}
          options={roleOptions}
          required
        />
        <TextField
          isAr={isAr}
          label={isAr ? "اللقب" : "Title"}
          hint={isAr ? "مثل: د." : "e.g. Dr."}
          value={m.title}
          onChange={(v) => onChange({ title: v })}
          optional
          maxLength={60}
        />
        <TextField
          isAr={isAr}
          className="sm:col-span-2"
          label={isAr ? "الاسم الكامل" : "Full name"}
          value={m.fullName}
          onChange={(v) => onChange({ fullName: v })}
          error={errors.fullName}
          required
          maxLength={120}
          autoComplete="off"
        />
        <TextField
          isAr={isAr}
          type="email"
          label={isAr ? "البريد الإلكتروني" : "Email"}
          value={m.email}
          onChange={(v) => onChange({ email: v })}
          error={errors.email}
          required
          dir="ltr"
          inputMode="email"
          autoComplete="off"
          maxLength={160}
        />
        <TextField
          isAr={isAr}
          type="tel"
          label={isAr ? "رقم الجوال" : "Mobile"}
          value={m.phone}
          onChange={(v) => onChange({ phone: v })}
          onBlur={() => {
            const n = normalizeSaudiMobile(m.phone);
            if (n) onChange({ phone: n });
          }}
          error={errors.phone}
          required
          dir="ltr"
          inputMode="tel"
          placeholder="05XXXXXXXX"
          maxLength={20}
        />
        {doctor && (
          <>
            <TextField
              isAr={isAr}
              label={isAr ? "رقم ترخيص مزاولة المهنة" : "Practitioner licence number"}
              value={m.licenceNo}
              onChange={(v) => onChange({ licenceNo: asciiDigits(v) })}
              error={errors.licenceNo}
              required
              dir="ltr"
              maxLength={60}
              inputClassName="tabular"
            />
            <TextField
              isAr={isAr}
              type="date"
              label={isAr ? "تاريخ انتهاء الترخيص" : "Licence expiry"}
              value={m.licenceExpiresAt}
              onChange={(v) => onChange({ licenceExpiresAt: v })}
              optional
              dir="ltr"
            />
          </>
        )}
      </div>

      {branches.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend id={groupId} className="text-sm font-medium">
            {isAr ? "الفروع التي يعمل بها" : "Works at"}
          </legend>
          <div className="flex flex-wrap gap-2">
            <label
              className={cn(
                "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium focus-within:ring-2 focus-within:ring-ring",
                allBranches ? "border-primary/40 bg-primary/[0.06] text-foreground" : "border-border text-muted-foreground"
              )}
            >
              <input
                type="checkbox"
                checked={allBranches}
                onChange={() => onChange({ branchIds: [] })}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              {isAr ? "كل الفروع" : "All branches"}
            </label>
            {branches.map((b) => {
              const on = m.branchIds.includes(b.id);
              return (
                <label
                  key={b.id}
                  className={cn(
                    "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium focus-within:ring-2 focus-within:ring-ring",
                    on ? "border-primary/40 bg-primary/[0.06] text-foreground" : "border-border text-muted-foreground"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => toggleBranch(b.id, e.target.checked)}
                    className="size-4 accent-[hsl(var(--primary))]"
                  />
                  {b.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </Card>
  );
}
