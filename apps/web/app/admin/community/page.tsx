"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Eye, Star, ExternalLink, Loader2, Cat as CatIcon } from "lucide-react";
import { Badge, Button, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Pagination } from "@/app/admin/_components/pagination";
import { ConfirmDialog } from "@/app/admin/_components/confirm";
import { fmtNum } from "@/app/admin/_components/i18n";

interface ModCat {
  id: string;
  name: string;
  publicSlug: string | null;
  photoUrl: string | null;
  isPublic: boolean;
  isFeatured: boolean;
  hiddenAt: string | null;
  viewCount: number;
  user: { email: string };
}

interface CommunityResp {
  items: ModCat[];
  pagination: { total: number; page: number; totalPages: number };
}

const FILTERS = [
  { key: "", en: "All shared", ar: "كل المشاركة" },
  { key: "public", en: "Public", ar: "عامة" },
  { key: "hidden", en: "Hidden", ar: "مخفية" },
  { key: "featured", en: "Featured", ar: "مميّزة" },
] as const;

export default function AdminCommunityPage() {
  const { authedFetch } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [hideTarget, setHideTarget] = React.useState<ModCat | null>(null);

  React.useEffect(() => { setPage(1); }, [filter]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-community", filter, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page) });
      if (filter) qs.set("filter", filter);
      return authedFetch<CommunityResp>(`/admin/community/cats?${qs.toString()}`);
    },
  });

  const mut = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: object }) =>
      authedFetch(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-community"] }),
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });

  const hideMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      authedFetch(`/admin/community/cats/${id}/hide`, { method: "PATCH", body: JSON.stringify(reason ? { reason } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-community"] });
      setHideTarget(null);
      toast({ title: isAr ? "تم إخفاء الملف" : "Profile hidden", variant: "success" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });

  const cats = data?.items ?? [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{isAr ? "إشراف المجتمع" : "Community moderation"}</h1>
          <p className="text-sm text-muted-foreground">{isAr ? "أخفِ الملفات غير اللائقة أو ميّز الرائعة منها." : "Hide inappropriate profiles or feature great ones."}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              filter === f.key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {isAr ? f.ar : f.en}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{isAr ? "تعذّر التحميل. حاول التحديث." : "Couldn’t load. Try refreshing."}</p>
      ) : cats.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed py-16 text-center">
          <CatIcon className="size-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">{isAr ? "لا توجد قطط مشاركة هنا بعد." : "No shared cats here yet."}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{isAr ? "القط" : "Cat"}</th>
                  <th className="p-3 text-start">{isAr ? "المالك" : "Owner"}</th>
                  <th className="p-3 text-start">{isAr ? "المشاهدات" : "Views"}</th>
                  <th className="p-3 text-start">{isAr ? "الحالة" : "Status"}</th>
                  <th className="p-3 text-end">{isAr ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cats.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {c.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.photoUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="grid size-full place-items-center"><CatIcon className="size-4 text-muted-foreground/50" /></span>
                          )}
                        </span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground" dir="ltr">{c.user.email}</td>
                    <td className="p-3 tabular-nums">{fmtNum(c.viewCount, isAr)}</td>
                    <td className="p-3">
                      {c.hiddenAt ? (
                        <Badge variant="destructive">{isAr ? "مخفي" : "Hidden"}</Badge>
                      ) : c.isFeatured ? (
                        <Badge variant="secondary"><Star className="me-1 size-3 fill-accent text-accent" /> {isAr ? "مميّز" : "Featured"}</Badge>
                      ) : (
                        <Badge variant="outline">{isAr ? "عام" : "Public"}</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.publicSlug && (
                          <a href={`/community/${c.publicSlug}`} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost" aria-label={isAr ? "عرض" : "View"}><ExternalLink className="size-4" /></Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => mut.mutate({ path: `/admin/community/cats/${c.id}/feature`, body: { featured: !c.isFeatured } })}
                          aria-label={isAr ? "تمييز" : "Feature"}
                        >
                          <Star className={cn("size-4", c.isFeatured && "fill-accent text-accent")} />
                        </Button>
                        {c.hiddenAt ? (
                          <Button size="sm" variant="outline" onClick={() => mut.mutate({ path: `/admin/community/cats/${c.id}/unhide` })}>
                            <Eye className="size-4" /> {isAr ? "إظهار" : "Unhide"}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setHideTarget(c)}>
                            <EyeOff className="size-4" /> {isAr ? "إخفاء" : "Hide"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && (
            <div className="mt-4">
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!hideTarget}
        onClose={() => setHideTarget(null)}
        onConfirm={(reason) => { if (hideTarget) hideMut.mutate({ id: hideTarget.id, reason }); }}
        pending={hideMut.isPending}
        isAr={isAr}
        destructive
        withReason
        title={isAr ? `إخفاء «${hideTarget?.name ?? ""}»؟` : `Hide “${hideTarget?.name ?? ""}”?`}
        description={isAr
          ? "سيُزال هذا الملف من كل الأماكن العامة في المجتمع. يمكن إظهاره لاحقاً."
          : "This profile will be removed from every public community surface. You can unhide it later."}
        confirmLabel={isAr ? "إخفاء الملف" : "Hide profile"}
        reasonLabel={isAr ? "سبب الإخفاء (اختياري)" : "Reason for hiding (optional)"}
      />
    </div>
  );
}
