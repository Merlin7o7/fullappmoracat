"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, X, ArrowLeft } from "lucide-react";
import { Card, Button, Skeleton, useToast, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { formatDateTime } from "@/lib/datetime";
import { Field, SelectField } from "@/components/field";
import { TicketStatusBadge } from "@/components/ticket-status-badge";
import { QueryError } from "@/components/query-error";
import { IlloHeart, IlloPaw } from "@/components/illustrations";

interface TicketMessage { id: string; body: string; isStaff: boolean; createdAt: string }
interface Ticket {
  ticketNumber: string; subject: string; status: string; priority: string;
  category: string | null; createdAt: string; updatedAt: string; messages: TicketMessage[];
}

export default function SupportPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);

  const { data: tickets, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["tickets", user?.id],
    queryFn: () => authedFetch<Ticket[]>("/support/tickets"),
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      authedFetch<Ticket>("/support/tickets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (t) => {
      try { sessionStorage.removeItem(TICKET_DRAFT_KEY); } catch { /* ignore */ }
      qc.invalidateQueries({ queryKey: ["tickets"] });
      setShowForm(false);
      setSelected(t.ticketNumber);
      toast({ title: isAr ? "تم فتح التذكرة" : "Ticket opened", description: t.ticketNumber, variant: "success" });
    },
    onError: (e) => toast({ title: isAr ? "تعذّر فتح التذكرة" : "Couldn't open ticket", description: e.message, variant: "error" }),
  });

  const active = tickets?.find((t) => t.ticketNumber === selected) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isAr ? "الدعم" : "Support"}</h1>
          <p className="text-sm text-muted-foreground">{isAr ? "نرد خلال ٢٤ ساعة — وغالباً أسرع" : "We reply within 24 hours — usually much faster"}</p>
        </div>
        {!active && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> {isAr ? "تذكرة جديدة" : "New ticket"}</Button>
        )}
      </div>

      {showForm && !active && (
        <TicketForm isAr={isAr} pending={create.isPending} onClose={() => setShowForm(false)} onSubmit={(b) => create.mutate(b)} />
      )}

      {active ? (
        <TicketThread
          ticket={active}
          isAr={isAr}
          onBack={() => setSelected(null)}
          authedFetch={authedFetch}
          onChanged={() => qc.invalidateQueries({ queryKey: ["tickets"] })}
        />
      ) : isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : tickets && tickets.length > 0 ? (
        <Card className="divide-y divide-border p-0">
          {tickets.map((t) => (
            <button
              key={t.ticketNumber}
              onClick={() => setSelected(t.ticketNumber)}
              className="flex w-full items-center justify-between gap-3 p-5 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{t.subject}</p>
                <p className="text-xs text-muted-foreground">{t.ticketNumber} · {t.messages.length} {isAr ? "رسالة" : "messages"}</p>
              </div>
              <TicketStatusBadge status={t.status} isAr={isAr} />
            </button>
          ))}
        </Card>
      ) : (
        /* Empty state = a welcome, not a void (R111). */
        <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <IlloPaw tone="butter" className="pointer-events-none absolute start-8 top-6 size-8 rotate-[-14deg] opacity-60" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
          <IlloHeart tone="pink" className="size-16" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {isAr ? "لا توجد تذاكر — كل شيء تمام 🎉" : "No tickets — everything's purring 🎉"}
          </p>
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-4" /> {isAr ? "افتح تذكرة" : "Open a ticket"}
          </Button>
        </Card>
      )}
    </div>
  );
}

function TicketThread({ ticket, isAr, onBack, authedFetch, onChanged }: {
  ticket: Ticket; isAr: boolean; onBack: () => void;
  authedFetch: ReturnType<typeof useAuth>["authedFetch"]; onChanged: () => void;
}) {
  const [body, setBody] = React.useState("");
  const { toast } = useToast();

  const reply = useMutation({
    mutationFn: () => authedFetch(`/support/tickets/${ticket.ticketNumber}/reply`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => { setBody(""); onChanged(); },
    onError: (e) => toast({ title: isAr ? "تعذّر الإرسال" : "Couldn't send", description: e.message, variant: "error" }),
  });
  const close = useMutation({
    mutationFn: () => authedFetch(`/support/tickets/${ticket.ticketNumber}/close`, { method: "POST", body: "{}" }),
    onSuccess: () => { onChanged(); toast({ title: isAr ? "أُغلقت التذكرة" : "Ticket closed", variant: "success" }); },
  });

  const isClosed = ticket.status === "CLOSED";
  const fmtTime = (d: string) => formatDateTime(d, isAr ? "ar" : "en");

  return (
    <Card className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label={isAr ? "رجوع" : "Back"}>
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Button>
          <div>
            <p className="font-display font-semibold">{ticket.subject}</p>
            <p className="text-xs text-muted-foreground">{ticket.ticketNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TicketStatusBadge status={ticket.status} isAr={isAr} />
          {!isClosed && (
            <Button variant="outline" size="sm" onClick={() => close.mutate()} loading={close.isPending}>
              <X className="size-4" /> {isAr ? "إغلاق" : "Close"}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 flex max-h-96 flex-col gap-3 overflow-y-auto">
        {ticket.messages.map((m) => (
          <div key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", m.isStaff ? "self-start bg-muted" : "self-end bg-primary/10")}>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">
              {m.isStaff ? (isAr ? "فريق مرقط" : "Moraqat Support") : (isAr ? "أنت" : "You")} · {fmtTime(m.createdAt)}
            </p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </div>

      {!isClosed && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (body.trim()) reply.mutate(); }}
          className="flex gap-2"
        >
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={isAr ? "اكتب ردك…" : "Write a reply…"}
            aria-label={isAr ? "ردك" : "Your reply"}
            className="h-11 flex-1 rounded-xl border border-input bg-background px-4 text-sm shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" loading={reply.isPending} disabled={!body.trim()} aria-label={isAr ? "إرسال" : "Send"}>
            <Send className="size-4 rtl:rotate-180" />
          </Button>
        </form>
      )}
    </Card>
  );
}

const TICKET_DRAFT_KEY = "moraqat.ticketDraft";

function TicketForm({ isAr, onSubmit, pending, onClose }: {
  isAr: boolean; onSubmit: (b: Record<string, unknown>) => void; pending: boolean; onClose: () => void;
}) {
  // A long support message must survive a session hiccup or accidental close
  // (R117) — draft to sessionStorage, cleared on successful submit.
  const [f, setF] = React.useState(() => {
    try {
      const raw = sessionStorage.getItem(TICKET_DRAFT_KEY);
      if (raw) return { subject: "", message: "", category: "order", ...JSON.parse(raw) as object };
    } catch { /* ignore */ }
    return { subject: "", message: "", category: "order" };
  });
  React.useEffect(() => {
    try {
      if (f.subject || f.message) sessionStorage.setItem(TICKET_DRAFT_KEY, JSON.stringify(f));
    } catch { /* ignore */ }
  }, [f]);
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">{isAr ? "تذكرة جديدة" : "New ticket"}</h3>
        <button onClick={onClose} aria-label="close"><X className="size-4 text-muted-foreground" /></button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="grid gap-4">
        <Field label={isAr ? "الموضوع" : "Subject"} required value={f.subject} onChange={(v) => setF({ ...f, subject: v })} />
        <SelectField label={isAr ? "التصنيف" : "Category"} value={f.category} onChange={(v) => setF({ ...f, category: v })}
          options={[
            { value: "order", label: isAr ? "طلب" : "Order" },
            { value: "delivery", label: isAr ? "توصيل" : "Delivery" },
            { value: "billing", label: isAr ? "فوترة" : "Billing" },
            { value: "subscription", label: isAr ? "اشتراك" : "Subscription" },
            { value: "product", label: isAr ? "منتج" : "Product" },
            { value: "other", label: isAr ? "أخرى" : "Other" },
          ]} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="ticket-msg">{isAr ? "الرسالة" : "Message"}</label>
          <textarea
            id="ticket-msg"
            value={f.message}
            onChange={(e) => setF({ ...f, message: e.target.value })}
            rows={4}
            required
            className="rounded-xl border border-input bg-background p-4 text-sm shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" loading={pending} disabled={!f.subject || !f.message} className="w-fit">
          {isAr ? "إرسال التذكرة" : "Submit ticket"}
        </Button>
      </form>
    </Card>
  );
}
