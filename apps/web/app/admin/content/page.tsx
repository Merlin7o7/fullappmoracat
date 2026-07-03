"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, X } from "lucide-react";
import { Card, Badge, Button, DataTable, useToast, type Column } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { Field } from "@/components/field";

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
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);

  const { data, isLoading } = useQuery({
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
        title: p.status === "PUBLISHED" ? "Post published" : "Post unpublished",
        description: p.titleEn,
        variant: "success",
      });
    },
    onError: (e) => toast({ title: "Action failed", description: e.message, variant: "error" }),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      authedFetch<PostRow>("/admin/cms/posts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
      setShowForm(false);
      toast({ title: "Draft created", description: p.titleEn, variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't create post", description: e.message, variant: "error" }),
  });

  const columns: Column<PostRow>[] = [
    {
      key: "titleEn", header: "Post", sortable: true,
      render: (p) => (
        <div>
          <p className="font-medium">{p.titleEn}</p>
          <p className="text-xs text-muted-foreground">/{p.slug}{p.category ? ` · ${p.category.nameEn}` : ""}</p>
        </div>
      ),
    },
    { key: "authorName", header: "Author", sortable: true, render: (p) => <span className="text-muted-foreground">{p.authorName ?? "—"}</span> },
    {
      key: "publishedAt", header: "Published", sortable: true,
      sortValue: (p) => p.publishedAt ?? "",
      render: (p) => (
        <span className="text-muted-foreground tabular">
          {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </span>
      ),
    },
    {
      key: "status", header: "Status", sortable: true,
      render: (p) => (
        <Badge dot variant={p.status === "PUBLISHED" ? "success" : p.status === "ARCHIVED" ? "secondary" : "warning"}>
          {p.status[0] + p.status.slice(1).toLowerCase()}
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
          {p.status === "PUBLISHED" ? "Unpublish" : "Publish"}
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Content</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.length} posts` : "—"}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> New post</Button>
      </div>

      {showForm && <PostForm onSubmit={(b) => create.mutate(b)} pending={create.isPending} onClose={() => setShowForm(false)} />}

      <DataTable
        columns={columns}
        data={data ?? []}
        rowKey={(p) => p.id}
        loading={isLoading}
        emptyState={<div className="flex flex-col items-center gap-2"><FileText className="size-8 opacity-40" />No posts yet</div>}
      />
    </div>
  );
}

function PostForm({ onSubmit, pending, onClose }: { onSubmit: (b: Record<string, unknown>) => void; pending: boolean; onClose: () => void }) {
  const [f, setF] = React.useState({ titleEn: "", titleAr: "", excerptEn: "", bodyEn: "", authorName: "" });
  const slug = f.titleEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post";
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">New post (saved as draft)</h3>
        <button onClick={onClose} aria-label="close"><X className="size-4 text-muted-foreground" /></button>
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
        <Field label="Title (EN)" required value={f.titleEn} onChange={(v) => setF({ ...f, titleEn: v })} />
        <Field label="Title (AR)" value={f.titleAr} onChange={(v) => setF({ ...f, titleAr: v })} />
        <Field label="Author" value={f.authorName} onChange={(v) => setF({ ...f, authorName: v })} className="sm:col-span-2" />
        <Field label="Excerpt" value={f.excerptEn} onChange={(v) => setF({ ...f, excerptEn: v })} className="sm:col-span-2" hint="Shown on the blog listing card." />
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="post-body">Body (EN)</label>
          <textarea
            id="post-body"
            value={f.bodyEn}
            onChange={(e) => setF({ ...f, bodyEn: e.target.value })}
            rows={6}
            className="rounded-xl border border-input bg-background p-4 text-sm shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Separate paragraphs with a blank line…"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" loading={pending} disabled={!f.titleEn}>Create draft</Button>
        </div>
      </form>
    </Card>
  );
}
