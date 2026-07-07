"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { Card, Badge, Button, useToast, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";
import { fmtDate } from "@/app/admin/_components/i18n";

interface Role {
  id: string;
  key: string;
  name: string;
  scope: string | null;
  isSystem: boolean;
  permissions: string[];
}
interface StaffMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string;
  roles: { key: string; name: string }[];
}

export default function AdminStaffPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();

  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: () => authedFetch<Role[]>("/admin/staff/roles") });
  const staff = useQuery({ queryKey: ["admin-staff"], queryFn: () => authedFetch<StaffMember[]>("/admin/staff") });

  const [email, setEmail] = React.useState("");
  const [roleKey, setRoleKey] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-staff"] });
  };

  const assign = useMutation({
    mutationFn: () =>
      authedFetch("/admin/staff", { method: "POST", body: JSON.stringify({ email, roleKey }) }),
    onSuccess: () => {
      setEmail("");
      setRoleKey("");
      setError(null);
      invalidate();
      toast({ title: isAr ? "تم تعيين الدور" : "Role assigned" });
    },
    onError: (e: Error) => setError(e.message),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => authedFetch(`/admin/staff/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast({ title: isAr ? "تم إلغاء صلاحية الفريق" : "Staff access revoked" });
    },
    onError: (e: Error) => toast({ title: e.message }),
  });

  const roleName = (key: string) => roles.data?.find((r) => r.key === key)?.name ?? key;

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold">{isAr ? "الفريق والصلاحيات" : "Staff & roles"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAr ? "عيّن أدواراً للموظفين — كل دور يمنح صلاحياته فقط." : "Assign roles to staff — each role grants only its permissions."}
        </p>
      </div>

      {/* Assign a role */}
      <Card className="mb-6 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display font-semibold">
          <UserPlus className="size-4" /> {isAr ? "تعيين دور" : "Assign a role"}
        </h2>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => { e.preventDefault(); assign.mutate(); }}
        >
          <Field
            type="email"
            label={isAr ? "بريد الموظف" : "Staff email"}
            value={email}
            onChange={setEmail}
            placeholder="name@example.com"
          />
          <SelectField
            label={isAr ? "الدور" : "Role"}
            value={roleKey}
            onChange={setRoleKey}
            options={[
              { value: "", label: isAr ? "اختر دوراً" : "Choose a role" },
              ...(roles.data ?? []).map((r) => ({ value: r.key, label: r.name })),
            ]}
          />
          <Button type="submit" disabled={assign.isPending || !email || !roleKey}>
            {assign.isPending && <Loader2 className="size-4 animate-spin" />}
            {isAr ? "تعيين" : "Assign"}
          </Button>
        </form>
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        {roleKey && (
          <p className="mt-3 text-xs text-muted-foreground">
            {isAr ? "صلاحيات هذا الدور: " : "This role grants: "}
            <span dir="ltr">{roles.data?.find((r) => r.key === roleKey)?.permissions.join(", ")}</span>
          </p>
        )}
      </Card>

      {/* Current staff */}
      {staff.isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : staff.isError ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{isAr ? "تعذّر التحميل." : "Couldn't load."}</p>
      ) : (staff.data ?? []).length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed py-16 text-center">
          <ShieldCheck className="size-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">{isAr ? "لا يوجد موظفون بعد." : "No staff yet."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{isAr ? "الموظف" : "Member"}</th>
                <th className="p-3 text-start">{isAr ? "الأدوار" : "Roles"}</th>
                <th className="p-3 text-start">{isAr ? "منذ" : "Since"}</th>
                <th className="p-3 text-end">{isAr ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(staff.data ?? []).map((m) => {
                const isSelf = m.id === user?.id;
                return (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{[m.firstName, m.lastName].filter(Boolean).join(" ") || "—"}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{m.email}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {m.roles.length ? m.roles.map((r) => (
                          <Badge key={r.key} variant="secondary">{roleName(r.key)}</Badge>
                        )) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{fmtDate(m.createdAt, isAr)}</td>
                    <td className="p-3 text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSelf || revoke.isPending}
                        title={isSelf ? (isAr ? "لا يمكنك إزالة نفسك" : "You can't remove yourself") : undefined}
                        onClick={() => {
                          if (confirm(isAr ? `إلغاء صلاحية ${m.email}؟` : `Revoke staff access for ${m.email}?`)) {
                            revoke.mutate(m.id);
                          }
                        }}
                        className={cn(!isSelf && "text-destructive hover:text-destructive")}
                      >
                        <Trash2 className="size-4" /> {isAr ? "إلغاء" : "Revoke"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
