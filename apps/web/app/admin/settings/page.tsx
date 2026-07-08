"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ToggleRight, Info } from "lucide-react";
import { Card, Badge, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";

interface Flag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  rollout: number;
  updatedAt: string;
}

export default function AdminSettingsPage() {
  const { authedFetch } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-flags"],
    queryFn: () => authedFetch<Flag[]>("/admin/feature-flags"),
  });

  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      authedFetch(`/admin/feature-flags/${key}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
    // Optimistic flip so the switch feels instant (R071).
    onMutate: async ({ key, enabled }) => {
      await qc.cancelQueries({ queryKey: ["admin-flags"] });
      const prev = qc.getQueryData<Flag[]>(["admin-flags"]);
      qc.setQueryData<Flag[]>(["admin-flags"], (old) => old?.map((f) => (f.key === key ? { ...f, enabled } : f)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-flags"], ctx.prev);
      toast({ title: isAr ? "تعذّر التبديل." : "Toggle failed.", variant: "error" });
    },
    onSuccess: (_r, v) => toast({ title: `${v.key} → ${v.enabled ? (isAr ? "مُفعّل" : "on") : (isAr ? "معطّل" : "off")}`, variant: "success" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-flags"] }),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold">{isAr ? "الإعدادات وأعلام الميزات" : "Settings & feature flags"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAr ? "بدّل الميزات مباشرة دون إعادة نشر." : "Toggle features at runtime — no redeploy."}
        </p>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-info/30 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <span>
          {isAr
            ? "مفتاح التجارة (COMMERCE_ENABLED) يُضبط عبر البيئة عمداً — يفشل مغلقاً عند الإقلاع ولا يظهر هنا."
            : "The commerce switch (COMMERCE_ENABLED) is an env var by design — it fails closed at boot and isn’t shown here."}
        </span>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{isAr ? "تعذّر التحميل. قد لا تملك صلاحية الإعدادات." : "Couldn’t load. You may not have settings permission."}</p>
      ) : (data ?? []).length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed py-16 text-center">
          <ToggleRight className="size-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">{isAr ? "لا أعلام ميزات مُعرّفة." : "No feature flags defined."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.map((f) => (
            <Card key={f.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{f.key}</span>
                  {f.enabled && <Badge variant="success" dot>{isAr ? "مُفعّل" : "on"}</Badge>}
                </div>
                {f.description && <p className="mt-0.5 text-sm text-muted-foreground">{f.description}</p>}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={f.enabled}
                aria-label={f.key}
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  f.enabled ? "bg-primary" : "bg-input",
                )}
              >
                <span className={cn("inline-block size-4 rounded-full bg-white transition-transform", f.enabled ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1")} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
