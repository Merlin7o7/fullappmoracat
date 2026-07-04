"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus, Search, Star, Settings2 } from "lucide-react";
import { Avatar, Badge, cn } from "@moraqat/ui";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";

/**
 * The cat selector — how a multi-cat household chooses "which cat, right now"
 * without navigating away (UX requirement: fast + elegant, never forced nav).
 * Search appears only when the roster is large, so it stays clean at 1 cat and
 * still scannable at 20 (Dashboard requirement).
 */
export function CatSwitcher({ isAr }: { isAr: boolean }) {
  const { activeCats, activeCat, setActiveCat, setPrimaryCat, isLoading } = useCats();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isLoading) {
    return <div className="h-10 w-40 animate-pulse rounded-xl bg-muted" aria-hidden />;
  }

  // No active cats yet — invite the first, don't show an empty switcher.
  if (activeCats.length === 0) {
    return (
      <Link
        href="/portal/cats"
        className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        <Plus className="size-4" />
        {isAr ? "أضف قطك الأول" : "Add your first cat"}
      </Link>
    );
  }

  const showSearch = activeCats.length > 5;
  const filtered = query.trim()
    ? activeCats.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          (c.catIdNumber ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : activeCats;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex max-w-[15rem] items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 text-start transition-colors hover:bg-muted",
          open && "ring-2 ring-primary/30"
        )}
      >
        <Avatar size="sm" name={activeCat?.name} src={activeCat?.photoUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">{localizeName(activeCat?.name, isAr ? "ar" : "en")}</span>
          <span className="block truncate font-mono text-[10px] leading-tight text-muted-foreground" dir="ltr">
            {activeCat?.catIdNumber}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute end-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-e3"
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isAr ? `قططك (${activeCats.length})` : `Your cats (${activeCats.length})`}
            </span>
            <Link
              href="/portal/cats"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {isAr ? "إدارة" : "Manage"}
            </Link>
          </div>

          {showSearch && (
            <div className="border-y border-border px-3 py-2">
              <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isAr ? "ابحث عن قط…" : "Search cats…"}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}

          <ul className="max-h-72 overflow-y-auto p-1.5">
            {filtered.map((c) => {
              const isActive = c.id === activeCat?.id;
              return (
                <li key={c.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors",
                      isActive ? "bg-primary/10" : "hover:bg-muted"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCat(c.id);
                        setOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-start"
                    >
                      <Avatar size="sm" name={c.name} src={c.photoUrl} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{localizeName(c.name, isAr ? "ar" : "en")}</span>
                          {c.isPrimary && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                              {isAr ? "الأساسي" : "Primary"}
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground" dir="ltr">
                          {c.catIdNumber}
                        </span>
                      </span>
                      {isActive && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                    {!c.isPrimary && (
                      <button
                        type="button"
                        title={isAr ? "اجعله الأساسي" : "Make primary"}
                        aria-label={isAr ? "اجعله الأساسي" : "Make primary"}
                        onClick={() => void setPrimaryCat(c.id)}
                        className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/15 hover:text-accent-foreground"
                      >
                        <Star className="size-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {isAr ? "ما لقينا قط بهذا الاسم" : "No cats match that search"}
              </li>
            )}
          </ul>

          <Link
            href="/portal/cats"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-border px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
          >
            <Plus className="size-4" />
            {isAr ? "أضف قط" : "Add a cat"}
          </Link>
        </div>
      )}
    </div>
  );
}

/** A compact inline selector for use inside flows (redeem, records, booking). */
export function InlineCatPicker({ onPick }: { onPick?: (id: string) => void }) {
  const { activeCats, activeCat, setActiveCat } = useCats();
  if (activeCats.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Settings2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {activeCats.map((c) => {
        const active = c.id === activeCat?.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setActiveCat(c.id);
              onPick?.(c.id);
            }}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors",
              active ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <Avatar size="sm" name={c.name} src={c.photoUrl} className="size-5" />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
