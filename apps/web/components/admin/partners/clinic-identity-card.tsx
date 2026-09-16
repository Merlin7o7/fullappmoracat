"use client";

/**
 * Who the clinic legally is, who to call, and how its invitation stands.
 * Registry numbers, emails and phones are always LTR islands inside the
 * Arabic layout (R101); the CR expiry turns amber/red as it lapses.
 */

import * as React from "react";
import { Building2, Mail, Phone, Link2 } from "lucide-react";
import { Badge } from "@moraqat/ui";
import type { RegistrationState } from "@/lib/vet-registration";
import { fmtDate } from "@/app/admin/_components/i18n";
import { ExpiryText, KV, SectionCard, daysUntil, fmtNumber } from "./shared";

const linkClass =
  "inline-flex min-h-[44px] items-center gap-1.5 text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded";

export function ClinicIdentityCard({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  const { org, owner } = state;
  return (
    <SectionCard icon={Building2} title={isAr ? "الهوية النظامية" : "Legal identity"}>
      <dl>
        <KV label={isAr ? "الاسم النظامي (عربي)" : "Legal name (Arabic)"}>{org.legalNameAr}</KV>
        <KV label={isAr ? "الاسم النظامي (إنجليزي)" : "Legal name (English)"} ltr>
          {org.legalNameEn}
        </KV>
        <KV label={isAr ? "رقم السجل التجاري" : "CR number"} ltr mono>
          {org.crNumber}
        </KV>
        <KV label={isAr ? "الرقم الوطني الموحد" : "Unified number"} ltr mono>
          {org.unifiedNumber}
        </KV>
        <KV label={isAr ? "انتهاء السجل" : "CR expiry"}>
          {org.crExpiresAt ? <ExpiryText iso={org.crExpiresAt} isAr={isAr} /> : null}
        </KV>
        <KV label={isAr ? "الرقم الضريبي" : "VAT number"} ltr mono>
          {org.vatNumber}
        </KV>
      </dl>

      <h3 className="mb-1 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {isAr ? "جهة الاتصال" : "Contact"}
      </h3>
      <dl>
        <KV label={isAr ? "الاسم" : "Name"}>{org.contactName}</KV>
        <KV label={isAr ? "البريد" : "Email"}>
          {org.contactEmail ? (
            <a href={`mailto:${org.contactEmail}`} className={linkClass} dir="ltr">
              <Mail aria-hidden className="size-3.5" />
              {org.contactEmail}
            </a>
          ) : null}
        </KV>
        <KV label={isAr ? "الجوال" : "Mobile"}>
          {org.contactPhone ? (
            <a href={`tel:${org.contactPhone.replace(/\s/g, "")}`} className={linkClass} dir="ltr">
              <Phone aria-hidden className="size-3.5" />
              {org.contactPhone}
            </a>
          ) : null}
        </KV>
        <KV label={isAr ? "حساب المالك" : "Owner account"}>
          {owner ? (
            <span className="text-end">
              {owner.name && <span className="block">{owner.name}</span>}
              <span className="block text-xs text-muted-foreground" dir="ltr">
                {owner.email}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{isAr ? "لم يُنشأ بعد" : "Not created yet"}</span>
          )}
        </KV>
      </dl>
    </SectionCard>
  );
}

export function RegistrationInviteCard({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  const inv = state.admin?.registrationInvite ?? null;
  const remaining = inv ? daysUntil(inv.expiresAt) : null;

  const stateBadge = !inv ? null : inv.revokedAt ? (
    <Badge variant="secondary">{isAr ? "مسحوبة" : "Withdrawn"}</Badge>
  ) : inv.claimedAt ? (
    <Badge variant="success">{isAr ? "استُخدمت" : "Claimed"}</Badge>
  ) : inv.expired ? (
    <Badge variant="destructive">{isAr ? "منتهية" : "Expired"}</Badge>
  ) : (
    <Badge variant="info">
      {remaining === 0
        ? isAr
          ? "تنتهي اليوم"
          : "Expires today"
        : isAr
          ? `باقي ${fmtNumber(remaining ?? 0, true)} يوم`
          : `${remaining}d left`}
    </Badge>
  );

  return (
    <SectionCard icon={Link2} title={isAr ? "دعوة التسجيل" : "Registration invitation"} action={stateBadge}>
      {!inv ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {isAr ? "لا توجد دعوة مسجّلة لهذه العيادة." : "No invitation on record for this clinic."}
        </p>
      ) : (
        <dl>
          <KV label={isAr ? "أُرسلت إلى" : "Sent to"} ltr>
            {inv.email}
          </KV>
          <KV label={isAr ? "تاريخ الإرسال" : "Sent"}>{fmtDate(inv.createdAt, isAr)}</KV>
          <KV label={isAr ? "صالحة حتى" : "Expires"}>
            <span className={inv.expired && !inv.claimedAt ? "text-destructive" : undefined}>{fmtDate(inv.expiresAt, isAr)}</span>
          </KV>
          {inv.claimedAt && <KV label={isAr ? "استُخدمت في" : "Claimed"}>{fmtDate(inv.claimedAt, isAr)}</KV>}
          {inv.revokedAt && <KV label={isAr ? "سُحبت في" : "Withdrawn"}>{fmtDate(inv.revokedAt, isAr)}</KV>}
        </dl>
      )}
    </SectionCard>
  );
}
