"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, ArrowLeft, CheckCheck, X } from "lucide-react";
import { Card, Badge, Button, DataTable, useToast, cn, type Column } from "@moraqat/ui";
import { IlloMouse } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { TicketStatusBadge } from "@/components/ticket-status-badge";
import { ConfirmDialog } from "@/app/admin/_components/confirm";
import { titleCase, fmtDate, fmtDateTime } from "@/app/admin/_components/i18n";
import { QueryError } from "@/components/query-error";

interface TicketMessage { id: string; body: string; isStaff: boolean; createdAt: string }
interface TicketRow {
  ticketNumber: string; subject: string; status: string; priority: string;
  category: string | null; updatedAt: string; messages: TicketMessage[];
  customer: { id: string; email: string; name: string };
}

const STATUSES = ["", "OPEN", "PENDING", "RESOLVED", "CLOSED"];

export default function AdminSupport() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-tickets", user?.id, filter],
    queryFn: () => authedFetch<TicketRow[]>(`/admin/support/tickets${filter ? `?status=${filter}` : ""}`),
    enabled: !!user?.isStaff,
  });

  const active = data?.find((t) => t.ticketNumber === selected) ?? null;

  const columns: Column<TicketRow>[] = [
    {
      key: "subject", header: isAr ? "التذكرة" : "Ticket", sortable: true,
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.subject}</p>
          <p className="text-xs text-muted-foreground">
            {t.ticketNumber} ·{" "}
            {/* Deep-link to the member's 360 page without triggering the row's thread-open. */}
            <Link
              href={`/admin/customers/${t.customer.id}`}
              onClick={(e) => e.stopPropagation()}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {t.customer.name}
            </Link>
          </p>
        </div>
      ),
    },
    { key: "category", header: isAr ? "التصنيف" : "Category", sortable: true, render: (t) => <span className="text-muted-foreground">{t.category ?? "—"}</span> },
    {
      key: "priority", header: isAr ? "الأولوية" : "Priority", sortable: true,
      render: (t) => <Badge variant={t.priority === "URGENT" ? "destructive" : t.priority === "HIGH" ? "warning" : "secondary"}>{titleCase(t.priority)}</Badge>,
    },
    {
      key: "updatedAt", header: isAr ? "آخر تحديث" : "Updated", sortable: true, sortValue: (t) => t.updatedAt,
      render: (t) => <span className="text-muted-foreground tabular">{fmtDate(t.updatedAt, isAr, { day: "numeric", month: "short" })}</span>,
    },
    { key: "status", header: isAr ? "الحالة" : "Status", sortable: true, render: (t) => <TicketStatusBadge status={t.status} isAr={isAr} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "الدعم" : "Support"}</h1>
          <p className="text-sm text-muted-foreground">{data ? (isAr ? `${data.length.toLocaleString("ar-SA")} تذكرة` : `${data.length} tickets`) : "—"}</p>
        </div>
        {!active && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="h-10 rounded-full border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {STATUSES.map((s) => <option key={s} value={s}>{s ? titleCase(s) : (isAr ? "كل الحالات" : "All statuses")}</option>)}
          </select>
        )}
      </div>

      {active ? (
        <StaffThread ticket={active} authedFetch={authedFetch} isAr={isAr} onBack={() => setSelected(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["admin-tickets"] })} />
      ) : isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          rowKey={(t) => t.ticketNumber}
          loading={isLoading}
          onRowClick={(t) => setSelected(t.ticketNumber)}
          emptyState={<div className="flex flex-col items-center gap-3"><IlloMouse tone="sage" className="h-8 w-auto opacity-80" />{isAr ? "لا توجد تذاكر" : "No tickets"}</div>}
        />
      )}
    </div>
  );
}

function StaffThread({ ticket, authedFetch, onBack, onChanged, isAr }: {
  ticket: TicketRow; authedFetch: ReturnType<typeof useAuth>["authedFetch"];
  onBack: () => void; onChanged: () => void; isAr: boolean;
}) {
  const [body, setBody] = React.useState("");
  const [confirmClose, setConfirmClose] = React.useState(false);
  const { toast } = useToast();

  const act = useMutation({
    mutationFn: ({ verb, payload }: { verb: string; payload?: Record<string, unknown> }) =>
      authedFetch(`/admin/support/tickets/${ticket.ticketNumber}/${verb}`, { method: "POST", body: JSON.stringify(payload ?? {}) }),
    onSuccess: (_d, { verb }) => {
      setBody("");
      setConfirmClose(false);
      onChanged();
      if (verb === "resolve") toast({ title: isAr ? "تم حل التذكرة" : "Ticket resolved", variant: "success" });
      else if (verb === "close") toast({ title: isAr ? "تم إغلاق التذكرة" : "Ticket closed", variant: "success" });
    },
    onError: (e) => toast({ title: isAr ? "فشل الإجراء" : "Action failed", description: e.message, variant: "error" }),
  });

  const isClosed = ticket.status === "CLOSED";

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back"><ArrowLeft className="size-4" /></Button>
          <div>
            <p className="font-display font-semibold">{ticket.subject}</p>
            <p className="text-xs text-muted-foreground">
              {ticket.ticketNumber} ·{" "}
              <Link href={`/admin/customers/${ticket.customer.id}`} className="underline-offset-2 hover:text-foreground hover:underline">
                {ticket.customer.name}
              </Link>{" "}
              (<span dir="ltr">{ticket.customer.email}</span>)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TicketStatusBadge status={ticket.status} isAr={isAr} />
          {!isClosed && ticket.status !== "RESOLVED" && (
            <Button variant="outline" size="sm" onClick={() => act.mutate({ verb: "resolve" })} disabled={act.isPending}>
              <CheckCheck className="size-4" /> {isAr ? "حل" : "Resolve"}
            </Button>
          )}
          {!isClosed && (
            <Button variant="ghost" size="sm" onClick={() => setConfirmClose(true)} disabled={act.isPending}>
              <X className="size-4" /> {isAr ? "إغلاق" : "Close"}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 flex max-h-96 flex-col gap-3 overflow-y-auto">
        {ticket.messages.map((m) => (
          <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", m.isStaff ? "self-end bg-primary/10" : "self-start bg-muted")}>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">
              {m.isStaff ? (isAr ? "الموظف" : "Staff") : ticket.customer.name} · {fmtDateTime(m.createdAt, isAr)}
            </p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </div>

      {!isClosed && (
        <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) act.mutate({ verb: "reply", payload: { body } }); }} className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={isAr ? "الرد على العميل…" : "Reply to the customer…"}
            aria-label={isAr ? "رد الموظف" : "Staff reply"}
            className="h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" disabled={!body.trim() || act.isPending} aria-label={isAr ? "إرسال" : "Send"}><Send className="size-4" /></Button>
        </form>
      )}

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => act.mutate({ verb: "close" })}
        pending={act.isPending}
        isAr={isAr}
        destructive
        title={isAr ? "إغلاق هذه التذكرة؟" : "Close this ticket?"}
        description={isAr
          ? "لن يتمكن العميل من الرد على تذكرة مغلقة. يمكنه فتح تذكرة جديدة إذا احتاج."
          : "The customer won’t be able to reply to a closed ticket. They can open a new one if needed."}
        confirmLabel={isAr ? "إغلاق التذكرة" : "Close ticket"}
      />
    </Card>
  );
}
