"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, Loader2 } from "lucide-react";
import { Card, Badge, Button, DataTable, cn, useToast, type Column } from "@moraqat/ui";
import { IlloSprig } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field } from "@/components/field";
import { titleCase, fmtDate } from "@/app/admin/_components/i18n";
import { QueryError } from "@/components/query-error";

interface PostRow {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  authorName: string | null;
  publishedAt: string | null;
  createdAt: string;
  category: { nameEn: string } | null;
}

export default function AdminContent() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [tab, setTab] = React.useState<"posts" | "faqs" | "announcements">("posts");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-posts", user?.id],
    queryFn: () => authedFetch<PostRow[]>("/admin/cms/posts"),
    enabled: !!user?.isStaff,
  });

  const publish = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "publish" | "unpublish" }) =>
      authedFetch<PostRow>(`/admin/cms/posts/${id}/${verb}`, { method: "POST", body: "{}" }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
      toast({
        title: p.status === "PUBLISHED" ? (isAr ? "تم نشر المقال" : "Post published") : (isAr ? "تم إلغاء النشر" : "Post unpublished"),
        description: p.titleEn,
        variant: "success",
      });
    },
    onError: (e) => toast({ title: isAr ? "فشل الإجراء" : "Action failed", description: e.message, variant: "error" }),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      authedFetch<PostRow>("/admin/cms/posts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
      setShowForm(false);
      toast({ title: isAr ? "تم إنشاء المسودة" : "Draft created", description: p.titleEn, variant: "success" });
    },
    onError: (e) => toast({ title: isAr ? "تعذّر إنشاء المقال" : "Couldn’t create post", description: e.message, variant: "error" }),
  });

  const columns: Column<PostRow>[] = [
    {
      key: "titleEn", header: isAr ? "المقال" : "Post", sortable: true,
      render: (p) => (
        <div>
          <p className="font-medium">{p.titleEn}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">/{p.slug}{p.category ? ` · ${p.category.nameEn}` : ""}</p>
        </div>
      ),
    },
    { key: "authorName", header: isAr ? "الكاتب" : "Author", sortable: true, render: (p) => <span className="text-muted-foreground">{p.authorName ?? "—"}</span> },
    {
      key: "publishedAt", header: isAr ? "النشر" : "Published", sortable: true,
      sortValue: (p) => p.publishedAt ?? "",
      render: (p) => (
        <span className="text-muted-foreground tabular">
          {p.publishedAt ? fmtDate(p.publishedAt, isAr, { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </span>
      ),
    },
    {
      key: "status", header: isAr ? "الحالة" : "Status", sortable: true,
      render: (p) => (
        <Badge dot variant={p.status === "PUBLISHED" ? "success" : p.status === "ARCHIVED" ? "secondary" : "warning"}>
          {statusLabel(p.status, isAr)}
        </Badge>
      ),
    },
    {
      key: "action", header: "", align: "end",
      render: (p) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={publish.isPending}
          onClick={() => publish.mutate({ id: p.id, verb: p.status === "PUBLISHED" ? "unpublish" : "publish" })}
        >
          {p.status === "PUBLISHED" ? (isAr ? "إلغاء النشر" : "Unpublish") : (isAr ? "نشر" : "Publish")}
        </Button>
      ),
    },
  ];

  const tabs: { key: typeof tab; en: string; ar: string }[] = [
    { key: "posts", en: "Blog", ar: "المدونة" },
    { key: "faqs", en: "FAQs", ar: "الأسئلة الشائعة" },
    { key: "announcements", en: "Announcements", ar: "الإعلانات" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "المحتوى" : "Content"}</h1>
          <p className="text-sm text-muted-foreground">{isAr ? "المدونة، الأسئلة الشائعة، وإعلانات الموقع." : "Blog, FAQs and site announcements."}</p>
        </div>
        {tab === "posts" && <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> {isAr ? "مقال جديد" : "New post"}</Button>}
      </div>

      <div className="flex gap-1 rounded-xl border border-border p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isAr ? t.ar : t.en}
          </button>
        ))}
      </div>

      {tab === "posts" ? (
        <>
          {showForm && <PostForm isAr={isAr} onSubmit={(b) => create.mutate(b)} pending={create.isPending} onClose={() => setShowForm(false)} />}
          {isError ? (
            <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
          ) : (
            <DataTable
              columns={columns}
              data={data ?? []}
              rowKey={(p) => p.id}
              loading={isLoading}
              emptyState={<div className="flex flex-col items-center gap-3"><IlloSprig tone="leaf" className="h-10 w-auto opacity-70" />{isAr ? "لا توجد مقالات بعد" : "No posts yet"}</div>}
            />
          )}
        </>
      ) : tab === "faqs" ? (
        <FaqsPanel isAr={isAr} />
      ) : (
        <AnnouncementsPanel isAr={isAr} />
      )}
    </div>
  );
}

// ── FAQs ────────────────────────────────────────────────────────────────────
interface FaqRow { id: string; questionEn: string; questionAr: string; answerEn: string; answerAr: string; category: string | null; status: string }

function FaqsPanel({ isAr }: { isAr: boolean }) {
  const { authedFetch } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = React.useState({ questionEn: "", questionAr: "", answerEn: "", answerAr: "", category: "" });

  const { data, isLoading } = useQuery({ queryKey: ["admin-faqs"], queryFn: () => authedFetch<FaqRow[]>("/admin/cms/faqs") });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch("/admin/cms/faqs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { setF({ questionEn: "", questionAr: "", answerEn: "", answerAr: "", category: "" }); qc.invalidateQueries({ queryKey: ["admin-faqs"] }); toast({ title: isAr ? "تمت الإضافة" : "FAQ added", variant: "success" }); },
    onError: (e) => toast({ title: isAr ? "تعذّرت الإضافة" : "Couldn’t add", description: e.message, variant: "error" }),
  });
  const del = useMutation({
    mutationFn: (id: string) => authedFetch(`/admin/cms/faqs/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-faqs"] }),
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate({ ...f, questionAr: f.questionAr || f.questionEn, answerAr: f.answerAr || f.answerEn, category: f.category || undefined }); }} className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? "السؤال (EN)" : "Question (EN)"} required value={f.questionEn} onChange={(v) => setF({ ...f, questionEn: v })} />
          <Field label={isAr ? "السؤال (AR)" : "Question (AR)"} value={f.questionAr} onChange={(v) => setF({ ...f, questionAr: v })} />
          <Field label={isAr ? "الإجابة (EN)" : "Answer (EN)"} required value={f.answerEn} onChange={(v) => setF({ ...f, answerEn: v })} />
          <Field label={isAr ? "الإجابة (AR)" : "Answer (AR)"} value={f.answerAr} onChange={(v) => setF({ ...f, answerAr: v })} />
          <Field label={isAr ? "التصنيف" : "Category"} value={f.category} onChange={(v) => setF({ ...f, category: v })} />
          <div className="sm:col-span-2"><Button type="submit" size="sm" loading={create.isPending} disabled={!f.questionEn || !f.answerEn}><Plus className="size-4" /> {isAr ? "إضافة سؤال" : "Add FAQ"}</Button></div>
        </form>
      </Card>
      {isLoading ? <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : (data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{isAr ? "لا أسئلة بعد." : "No FAQs yet."}</p>
      ) : (
        <div className="space-y-2">
          {data!.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="font-medium">{isAr ? q.questionAr : q.questionEn}</p>
                <p className="mt-1 text-sm text-muted-foreground">{isAr ? q.answerAr : q.answerEn}</p>
                {q.category && <Badge variant="secondary" className="mt-2">{q.category}</Badge>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(q.id)} aria-label={isAr ? "حذف" : "Delete"} className="shrink-0 text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Announcements ────────────────────────────────────────────────────────────
interface AnnRow { id: string; messageEn: string; messageAr: string; linkUrl: string | null; status: string; startsAt: string | null; endsAt: string | null }

function AnnouncementsPanel({ isAr }: { isAr: boolean }) {
  const { authedFetch } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = React.useState({ messageEn: "", messageAr: "", linkUrl: "" });

  const { data, isLoading } = useQuery({ queryKey: ["admin-anns"], queryFn: () => authedFetch<AnnRow[]>("/admin/cms/announcements") });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch("/admin/cms/announcements", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { setF({ messageEn: "", messageAr: "", linkUrl: "" }); qc.invalidateQueries({ queryKey: ["admin-anns"] }); toast({ title: isAr ? "تم النشر" : "Announcement posted", variant: "success" }); },
    onError: (e) => toast({ title: isAr ? "تعذّر النشر" : "Couldn’t post", description: e.message, variant: "error" }),
  });
  const publish = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => authedFetch(`/admin/cms/announcements/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-anns"] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => authedFetch(`/admin/cms/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-anns"] }),
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate({ messageEn: f.messageEn, messageAr: f.messageAr || f.messageEn, linkUrl: f.linkUrl || undefined, status: "PUBLISHED" }); }} className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? "الرسالة (EN)" : "Message (EN)"} required value={f.messageEn} onChange={(v) => setF({ ...f, messageEn: v })} />
          <Field label={isAr ? "الرسالة (AR)" : "Message (AR)"} value={f.messageAr} onChange={(v) => setF({ ...f, messageAr: v })} />
          <Field label={isAr ? "رابط (اختياري)" : "Link (optional)"} value={f.linkUrl} onChange={(v) => setF({ ...f, linkUrl: v })} className="sm:col-span-2" hint="https://…" />
          <div className="sm:col-span-2"><Button type="submit" size="sm" loading={create.isPending} disabled={!f.messageEn}><Plus className="size-4" /> {isAr ? "نشر إعلان" : "Publish announcement"}</Button></div>
        </form>
      </Card>
      {isLoading ? <div className="grid place-items-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : (data ?? []).length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{isAr ? "لا إعلانات." : "No announcements."}</p>
      ) : (
        <div className="space-y-2">
          {data!.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="font-medium">{isAr ? a.messageAr : a.messageEn}</p>
                {a.linkUrl && <a href={a.linkUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground" dir="ltr">{a.linkUrl}</a>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge dot variant={a.status === "PUBLISHED" ? "success" : "warning"}>{a.status}</Badge>
                <Button variant="ghost" size="sm" onClick={() => publish.mutate({ id: a.id, status: a.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED" })}>
                  {a.status === "PUBLISHED" ? (isAr ? "أرشفة" : "Archive") : (isAr ? "نشر" : "Publish")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => del.mutate(a.id)} aria-label={isAr ? "حذف" : "Delete"} className="text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const POST_STATUS_AR: Record<string, string> = {
  DRAFT: "مسودة",
  SCHEDULED: "مجدول",
  PUBLISHED: "منشور",
  ARCHIVED: "مؤرشف",
};
const statusLabel = (s: string, isAr: boolean) => (isAr ? POST_STATUS_AR[s] ?? s : titleCase(s));

function PostForm({ onSubmit, pending, onClose, isAr }: { onSubmit: (b: Record<string, unknown>) => void; pending: boolean; onClose: () => void; isAr: boolean }) {
  const [f, setF] = React.useState({ titleEn: "", titleAr: "", excerptEn: "", bodyEn: "", authorName: "" });
  const slug = f.titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post";
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">{isAr ? "مقال جديد (يُحفظ كمسودة)" : "New post (saved as draft)"}</h3>
        <button onClick={onClose} aria-label={isAr ? "إغلاق" : "close"}><X className="size-4 text-muted-foreground" /></button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            slug: `${slug}-${Date.now().toString(36)}`,
            titleEn: f.titleEn,
            titleAr: f.titleAr || f.titleEn,
            excerptEn: f.excerptEn || undefined,
            bodyEn: f.bodyEn || undefined,
            authorName: f.authorName || undefined,
          });
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label={isAr ? "العنوان (إنجليزي)" : "Title (EN)"} required value={f.titleEn} onChange={(v) => setF({ ...f, titleEn: v })} />
        <Field label={isAr ? "العنوان (عربي)" : "Title (AR)"} value={f.titleAr} onChange={(v) => setF({ ...f, titleAr: v })} />
        <Field label={isAr ? "الكاتب" : "Author"} value={f.authorName} onChange={(v) => setF({ ...f, authorName: v })} className="sm:col-span-2" />
        <Field label={isAr ? "المقتطف" : "Excerpt"} value={f.excerptEn} onChange={(v) => setF({ ...f, excerptEn: v })} className="sm:col-span-2" hint={isAr ? "يظهر على بطاقة قائمة المدونة." : "Shown on the blog listing card."} />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="post-body">{isAr ? "المحتوى (إنجليزي)" : "Body (EN)"}</label>
          <textarea
            id="post-body"
            value={f.bodyEn}
            onChange={(e) => setF({ ...f, bodyEn: e.target.value })}
            rows={6}
            className="rounded-xl border border-input bg-background p-4 text-sm shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={isAr ? "افصل الفقرات بسطر فارغ…" : "Separate paragraphs with a blank line…"}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" loading={pending} disabled={!f.titleEn}>{isAr ? "إنشاء مسودة" : "Create draft"}</Button>
        </div>
      </form>
    </Card>
  );
}
