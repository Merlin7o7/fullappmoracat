"use client";

/**
 * Team — three views of the same people, because they diverge in practice:
 *   1. who the owner listed at registration,
 *   2. which invitations went out (sent at submission) and whether they landed,
 *   3. the seats that actually exist, with the safeguards each has completed
 *      (confidentiality undertaking, counter PIN).
 */

import * as React from "react";
import { Users, Check, Minus } from "lucide-react";
import { Badge } from "@moraqat/ui";
import { VET_ROLE_LABELS, isDoctorRole } from "@moraqat/core";
import type { RegistrationState, RegInvite } from "@/lib/vet-registration";
import { fmtDate } from "@/app/admin/_components/i18n";
import { ExpiryText, SectionCard, fmtNumber } from "./shared";

const th = "px-2 py-2 text-start text-xs font-medium text-muted-foreground";
const td = "px-2 py-2.5 align-top";

function Tick({ ok, isAr, yes, no }: { ok: boolean; isAr: boolean; yes: { ar: string; en: string }; no: { ar: string; en: string } }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check aria-hidden className="size-4" />
      <span className="text-xs">{isAr ? yes.ar : yes.en}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus aria-hidden className="size-4" />
      <span className="text-xs">{isAr ? no.ar : no.en}</span>
    </span>
  );
}

function inviteBadge(state: RegInvite["state"], isAr: boolean) {
  switch (state) {
    case "accepted":
      return <Badge variant="success">{isAr ? "قُبلت" : "Accepted"}</Badge>;
    case "expired":
      return <Badge variant="destructive">{isAr ? "منتهية" : "Expired"}</Badge>;
    default:
      return <Badge variant="info">{isAr ? "بانتظار القبول" : "Pending"}</Badge>;
  }
}

const STAFF_STATUS: Record<string, { ar: string; en: string; variant: "success" | "info" | "destructive" | "secondary" }> = {
  ACTIVE: { ar: "نشط", en: "Active", variant: "success" },
  INVITED: { ar: "مدعو", en: "Invited", variant: "info" },
  SUSPENDED: { ar: "موقوف", en: "Suspended", variant: "destructive" },
  OFFBOARDED: { ar: "غادر", en: "Offboarded", variant: "secondary" },
};

export function ClinicTeamCard({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  const branchName = (id: string) => {
    const idx = state.branches.findIndex((b) => b.id === id);
    const b = state.branches[idx];
    if (!b) return isAr ? "فرع محذوف" : "Removed branch";
    return (isAr ? b.nameAr : b.nameEn) || b.nameAr || b.nameEn || (isAr ? `الفرع ${fmtNumber(idx + 1, true)}` : `Branch ${idx + 1}`);
  };
  const staff = state.admin?.staff ?? [];

  return (
    <SectionCard icon={Users} title={isAr ? "الفريق" : "Team"}>
      <div className="space-y-6">
        {/* 1 — listed at registration */}
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isAr ? `من أضافهم المالك (${fmtNumber(state.team.length, true)})` : `Listed by the owner (${state.team.length})`}
          </h3>
          {state.team.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{isAr ? "لم يُضف أحد بعد." : "Nobody listed yet."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{isAr ? "الفريق المُدرج في التسجيل" : "Team listed in the registration"}</caption>
                <thead className="border-b border-border">
                  <tr>
                    <th scope="col" className={th}>{isAr ? "الاسم" : "Name"}</th>
                    <th scope="col" className={th}>{isAr ? "الدور" : "Role"}</th>
                    <th scope="col" className={th}>{isAr ? "ترخيص المزاولة" : "Practitioner licence"}</th>
                    <th scope="col" className={th}>{isAr ? "الفروع" : "Branches"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {state.team.map((m) => {
                    const role = VET_ROLE_LABELS[m.role];
                    const doctorMissingLicence = isDoctorRole(m.role) && !m.licenceNo;
                    return (
                      <tr key={m.email}>
                        <td className={td}>
                          <p className="font-medium">{m.fullName}</p>
                          {m.title && <p className="text-xs text-muted-foreground">{m.title}</p>}
                          <p className="text-xs text-muted-foreground" dir="ltr">
                            <span className="inline-block">{m.email}</span>
                          </p>
                          <p className="text-xs text-muted-foreground" dir="ltr">
                            <span className="inline-block">{m.phone}</span>
                          </p>
                        </td>
                        <td className={td}>{role ? (isAr ? role.ar : role.en) : m.role}</td>
                        <td className={td}>
                          {m.licenceNo ? (
                            <>
                              <p className="font-mono text-xs" dir="ltr">
                                <span className="inline-block">{m.licenceNo}</span>
                              </p>
                              {m.licenceExpiresAt && <ExpiryText iso={m.licenceExpiresAt} isAr={isAr} className="text-xs" />}
                            </>
                          ) : doctorMissingLicence ? (
                            <Badge variant="destructive">{isAr ? "مفقود" : "Missing"}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className={td}>
                          {m.branchIds.length === 0 ? (
                            <span className="text-muted-foreground">{isAr ? "كل الفروع" : "All branches"}</span>
                          ) : (
                            m.branchIds.map(branchName).join(isAr ? "، " : ", ")
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2 — invitations */}
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isAr ? `دعوات الفريق (${fmtNumber(state.invites.length, true)})` : `Team invitations (${state.invites.length})`}
          </h3>
          {state.invites.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              {isAr ? "تُرسل الدعوات عند إرسال التسجيل للمراجعة." : "Invitations go out when the registration is submitted."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {state.invites.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{inv.fullName || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      <span dir="ltr" className="inline-block">
                        {inv.email}
                      </span>
                      {" · "}
                      {isAr ? inv.roleLabel.ar : inv.roleLabel.en}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {inv.state === "pending"
                        ? isAr
                          ? `حتى ${fmtDate(inv.expiresAt, true)}`
                          : `until ${fmtDate(inv.expiresAt, false)}`
                        : isAr
                          ? `أُرسلت ${fmtDate(inv.createdAt, true)}`
                          : `sent ${fmtDate(inv.createdAt, false)}`}
                    </span>
                    {inviteBadge(inv.state, isAr)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3 — actual seats */}
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isAr ? `الحسابات الفعلية (${fmtNumber(staff.length, true)})` : `Actual seats (${staff.length})`}
          </h3>
          {staff.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{isAr ? "لا توجد حسابات بعد." : "No seats yet."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{isAr ? "حسابات فريق العيادة" : "Clinic staff seats"}</caption>
                <thead className="border-b border-border">
                  <tr>
                    <th scope="col" className={th}>{isAr ? "الاسم" : "Name"}</th>
                    <th scope="col" className={th}>{isAr ? "الدور" : "Role"}</th>
                    <th scope="col" className={th}>{isAr ? "الحالة" : "Status"}</th>
                    <th scope="col" className={th}>{isAr ? "تعهّد السرية" : "Confidentiality"}</th>
                    <th scope="col" className={th}>{isAr ? "رمز الاستقبال" : "Counter PIN"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staff.map((s) => {
                    const st = STAFF_STATUS[s.status] ?? { ar: s.status, en: s.status, variant: "secondary" as const };
                    return (
                      <tr key={s.id}>
                        <td className={td}>
                          <p className="font-medium">{s.name || "—"}</p>
                          <p className="text-xs text-muted-foreground" dir="ltr">
                            <span className="inline-block">{s.email}</span>
                          </p>
                          {s.joinedAt && (
                            <p className="text-xs text-muted-foreground">
                              {isAr ? "انضم " : "Joined "}
                              {fmtDate(s.joinedAt, isAr)}
                            </p>
                          )}
                        </td>
                        <td className={td}>
                          {isAr ? s.roleLabel.ar : s.roleLabel.en}
                          {s.licenceNo && (
                            <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                              <span className="inline-block">{s.licenceNo}</span>
                            </p>
                          )}
                        </td>
                        <td className={td}>
                          <Badge variant={st.variant}>{isAr ? st.ar : st.en}</Badge>
                        </td>
                        <td className={td}>
                          <Tick ok={s.confidentialityAccepted} isAr={isAr} yes={{ ar: "موافق", en: "Accepted" }} no={{ ar: "لم يوافق", en: "Not yet" }} />
                        </td>
                        <td className={td}>
                          <Tick ok={s.hasCounterPin} isAr={isAr} yes={{ ar: "معيّن", en: "Set" }} no={{ ar: "غير معيّن", en: "Not set" }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
