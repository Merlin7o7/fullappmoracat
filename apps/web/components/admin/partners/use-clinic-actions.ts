"use client";

/**
 * Every reviewer mutation on one clinic, in one place, so each gets the same
 * treatment: a pending state on the exact button pressed, a bilingual success
 * toast, and an error that says what happened and what to do next (R084,
 * R112) — with the API's gap list kept on screen, not flashed and lost.
 *
 * When an endpoint returns the fresh RegistrationState we write it straight
 * into the cache (no flicker, no second request); otherwise we refetch.
 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@moraqat/ui";
import type { RegistrationGap, RegistrationStep } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { useRegistrationApi, registrationError, type RegistrationState } from "@/lib/vet-registration";
import { fmtDate } from "@/app/admin/_components/i18n";
import { describeError } from "./shared";

export type ClinicAction =
  | { kind: "resend" }
  | { kind: "revoke" }
  | { kind: "approve" }
  | { kind: "request-changes"; note: string; steps: RegistrationStep[] }
  | { kind: "reject"; reason: string }
  | { kind: "go-live" }
  | { kind: "verify" }
  | { kind: "unverify" }
  | { kind: "suspend"; reason: string }
  | { kind: "unsuspend" };

export type ClinicActionKind = ClinicAction["kind"];

export interface ActionError {
  title: string;
  message: string;
  gaps?: RegistrationGap[];
}

export function clinicDetailKey(userId: string | undefined, orgId: string) {
  return ["admin-clinic", userId, orgId] as const;
}

function isRegistrationState(v: unknown): v is RegistrationState {
  return !!v && typeof v === "object" && "org" in v && "documents" in v && "branches" in v;
}

const DONE: Record<ClinicActionKind, { ar: string; en: string }> = {
  resend: { ar: "أُعيد إرسال الدعوة", en: "Invitation resent" },
  revoke: { ar: "سُحبت الدعوة", en: "Invitation withdrawn" },
  approve: { ar: "قُبلت العيادة — بدأ التجهيز", en: "Clinic approved — setup has started" },
  "request-changes": { ar: "أُرسل طلب التعديلات للعيادة", en: "Change request sent to the clinic" },
  reject: { ar: "رُفض التسجيل", en: "Registration rejected" },
  "go-live": { ar: "العيادة فعّالة الآن", en: "The clinic is live" },
  verify: { ar: "وُثّقت العيادة", en: "Clinic verified" },
  unverify: { ar: "أُزيل التوثيق", en: "Verification removed" },
  suspend: { ar: "أُوقفت العيادة", en: "Clinic suspended" },
  unsuspend: { ar: "أُعيدت العيادة — تحتاج تفعيلاً من جديد", en: "Clinic reinstated — switch it live again when ready" },
};

export function useClinicActions(orgId: string, isAr: boolean) {
  const api = useRegistrationApi();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [error, setError] = React.useState<ActionError | null>(null);
  const key = clinicDetailKey(user?.id, orgId);

  const afterWrite = (res: unknown) => {
    if (isRegistrationState(res)) {
      qc.setQueryData(key, res);
    } else {
      void qc.invalidateQueries({ queryKey: ["admin-clinic", user?.id, orgId] });
    }
    void qc.invalidateQueries({ queryKey: ["admin-clinics"] });
  };

  const fail = (err: unknown) => {
    const f = registrationError(err, isAr);
    setError({ title: f.title, message: f.message, gaps: f.gaps });
    const d = describeError(err, isAr);
    toast({ title: d.title, description: d.description, variant: "error" });
  };

  const action = useMutation({
    mutationFn: async (a: ClinicAction): Promise<unknown> => {
      switch (a.kind) {
        case "resend":
          return api.adminResendInvite(orgId);
        case "revoke":
          return api.adminRevokeInvite(orgId);
        case "approve":
          return api.adminApprove(orgId);
        case "request-changes":
          return api.adminRequestChanges(orgId, { note: a.note, steps: a.steps });
        case "reject":
          return api.adminReject(orgId, a.reason);
        case "suspend":
          return api.adminSuspend(orgId, a.reason);
        case "go-live":
        case "verify":
        case "unverify":
        case "unsuspend":
          return api.adminOrgAction(orgId, a.kind);
      }
    },
    onMutate: () => setError(null),
    onSuccess: (res, a) => {
      afterWrite(res);
      const done = DONE[a.kind];
      let description: string | undefined;
      if (a.kind === "resend") {
        const inv = (res as { invite?: { email?: string; expiresAt?: string } } | null)?.invite;
        if (inv?.email && inv.expiresAt) {
          description = isAr
            ? `إلى ${inv.email} — صالحة حتى ${fmtDate(inv.expiresAt, true)}`
            : `To ${inv.email} — valid until ${fmtDate(inv.expiresAt, false)}`;
        }
      }
      toast({ title: isAr ? done.ar : done.en, description, variant: "success" });
    },
    onError: fail,
  });

  const docMutation = useMutation({
    mutationFn: ({ documentId, verified }: { documentId: string; verified: boolean }) =>
      api.adminVerifyDocument(orgId, documentId, verified),
    onMutate: () => setError(null),
    onSuccess: (res, v) => {
      afterWrite(res);
      toast({
        title: v.verified ? (isAr ? "تم التحقق من المستند" : "Document verified") : isAr ? "أُلغي التحقق" : "Verification removed",
        variant: "success",
      });
    },
    onError: fail,
  });

  return {
    /** Run an action; `onDone` fires only on success (e.g. close its dialog). */
    run: (a: ClinicAction, onDone?: () => void) => action.mutate(a, { onSuccess: () => onDone?.() }),
    pendingKind: action.isPending ? action.variables?.kind ?? null : null,
    verifyDocument: (documentId: string, verified: boolean) => docMutation.mutate({ documentId, verified }),
    pendingDocumentId: docMutation.isPending ? docMutation.variables?.documentId ?? null : null,
    error,
    clearError: () => setError(null),
  };
}

export type ClinicActions = ReturnType<typeof useClinicActions>;
