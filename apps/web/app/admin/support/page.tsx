"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, ArrowLeft, CheckCheck, X } from "lucide-react";
import { Card, Badge, Button, DataTable, useToast, cn, type Column } from "@moraqat/ui";
import { IlloMouse } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { TicketStatusBadge } from "@/components/ticket-status-badge";

interface TicketMessage { id: string; body: string; isStaff: boolean; createdAt: string }
interface TicketRow {
  ticketNumber: string; subject: string; status: string; priority: string;
  category: string | null; updatedAt: string; messages: TicketMessage[];
  customer: { email: string; name: string };
}

const STATUSES = ["", "OPEN", "PENDING", "RESOLVED", "CLOSED"];

export default function AdminSupport() {
  const { authedFetch, user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tickets", user?.id, filter],
    queryFn: () => authedFetch<TicketRow[]>(`/admin/support/tickets${filter ? `?status=${filter}` : ""}`),
    enabled: !!user?.isStaff,
  });

  const active = data?.find((t) => t.ticketNumber === selected) ?? null;

  const columns: Column<TicketRow>[] = [
    {
      key: "subject", header: "Ticket", sortable: true,
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.subject}</p>
          <p className="text-xs text-muted-foreground">{t.ticketNumber} · {t.customer.name}</p>
        </div>
      ),
    },
    { key: "category", header: "Category", sortable: true, render: (t) => <span className="text-muted-foreground">{t.category ?? "—"}</span> },
    {
      key: "priority", header: "Priority", sortable: true,
      render: (t) => <Badge variant={t.priority === "URGENT" ? "destructive" : t.priority === "HIGH" ? "warning" : "secondary"}>{t.priority[0] + t.priority.slice(1).toLowerCase()}</Badge>,
    },
    {
      key: "updatedAt", header: "Updated", sortable: true, sortValue: (t) => t.updatedAt,
      render: (t) => <span className="text-muted-foreground tabular">{new Date(t.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>,
    },
    { key: "status", header: "Status", sortable: true, render: (t) => <TicketStatusBadge status={t.status} isAr={false} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.length} tickets` : "—"}</p>
        </div>
        {!active && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="h-10 rounded-full border border-input bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {STATUSES.map((s) => <option key={s} value={s}>{s ? s[0] + s.slice(1).toLowerCase() : "All statuses"}</option>)}
          </select>
        )}
      </div>

      {active ? (
        <StaffThread ticket={active} authedFetch={authedFetch} onBack={() => setSelected(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["admin-tickets"] })} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          rowKey={(t) => t.ticketNumber}
          loading={isLoading}
          onRowClick={(t) => setSelected(t.ticketNumber)}
          emptyState={<div className="flex flex-col items-center gap-3"><IlloMouse tone="sage" className="h-8 w-auto opacity-80" />No tickets</div>}
        />
      )}
    </div>
  );
}

function StaffThread({ ticket, authedFetch, onBack, onChanged }: {
  ticket: TicketRow; authedFetch: ReturnType<typeof useAuth>["authedFetch"];
  onBack: () => void; onChanged: () => void;
}) {
  const [body, setBody] = React.useState("");
  const { toast } = useToast();

  const act = useMutation({
    mutationFn: ({ verb, payload }: { verb: string; payload?: Record<string, unknown> }) =>
      authedFetch(`/admin/support/tickets/${ticket.ticketNumber}/${verb}`, { method: "POST", body: JSON.stringify(payload ?? {}) }),
    onSuccess: (_d, { verb }) => {
      setBody("");
      onChanged();
      if (verb !== "reply") toast({ title: `Ticket ${verb}d`, variant: "success" });
    },
    onError: (e) => toast({ title: "Action failed", description: e.message, variant: "error" }),
  });

  const isClosed = ticket.status === "CLOSED";
  const fmtTime = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back"><ArrowLeft className="size-4" /></Button>
          <div>
            <p className="font-display font-semibold">{ticket.subject}</p>
            <p className="text-xs text-muted-foreground">{ticket.ticketNumber} · {ticket.customer.name} ({ticket.customer.email})</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TicketStatusBadge status={ticket.status} isAr={false} />
          {!isClosed && ticket.status !== "RESOLVED" && (
            <Button variant="outline" size="sm" onClick={() => act.mutate({ verb: "resolve" })} disabled={act.isPending}>
              <CheckCheck className="size-4" /> Resolve
            </Button>
          )}
          {!isClosed && (
            <Button variant="ghost" size="sm" onClick={() => act.mutate({ verb: "close" })} disabled={act.isPending}>
              <X className="size-4" /> Close
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 flex max-h-96 flex-col gap-3 overflow-y-auto">
        {ticket.messages.map((m) => (
          <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", m.isStaff ? "self-end bg-primary/10" : "self-start bg-muted")}>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">
              {m.isStaff ? "Staff" : ticket.customer.name} · {fmtTime(m.createdAt)}
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
            placeholder="Reply to the customer…"
            aria-label="Staff reply"
            className="h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" disabled={!body.trim() || act.isPending} aria-label="Send"><Send className="size-4" /></Button>
        </form>
      )}
    </Card>
  );
}
