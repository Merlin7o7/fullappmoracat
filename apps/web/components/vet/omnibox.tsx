"use client";

/**
 * The omnibox — the spine of the vet portal (MRC-VET-001 §05).
 *
 * The receptionist should never have to decide *how* to search. One box takes a
 * scanned card, a Cat ID, a microchip, a phone number or a name, works out
 * which it got, and answers. It is persistent, focused on load, and reachable
 * with `/` from anywhere in the portal.
 *
 * Four details do most of the work:
 *
 *  1. **The wedge listener.** USB/Bluetooth scanners type. A burst of
 *     machine-speed keystrokes ending in Enter is recognised *anywhere* in the
 *     app — the cashier never has to click into the field first. The single
 *     highest-leverage detail in the portal.
 *  2. **Detection before the round-trip.** The type chip appears as you type,
 *     from a local detector, so the box has already told you it understood.
 *  3. **The privacy boundary, spoken warmly.** Name search only reaches this
 *     clinic's own patients. When a name finds nothing, the empty state
 *     explains the boundary as a protection for members, not a limitation of
 *     the software — and offers the exact-identifier path that always works.
 *  4. **Keyboard-first.** ↑/↓/Enter through results, Esc closes without losing
 *     what was typed (R117).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { Badge, cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import {
  detectVetQuery,
  isExactIdentifier,
  pushRecentLookup,
  readRecentLookups,
  useVetActor,
  useVetApi,
  vetDetectedTypeLabel,
  vetFriendlyError,
  type VetDetectedType,
  type VetRecentLookup,
  type VetSearchResult,
} from "@/lib/vet-api";

/** Long enough to stop hammering the API, short enough to feel instant. */
const DEBOUNCE_MS = 180;
const MIN_NAME_CHARS = 2;
/** Humans don't type this fast; scanners do. */
const WEDGE_MAX_GAP_MS = 35;
const WEDGE_MIN_LENGTH = 6;

type Status = "idle" | "typing" | "loading" | "done" | "error";

export function Omnibox({
  className,
  /** Today focuses the box on load — zero clicks to a scan or a lookup. */
  autoFocus,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const api = useVetApi();
  const { orgId, can } = useVetActor();
  const allowed = can("patient.search");

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const seqRef = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);

  const [value, setValue] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<Status>("idle");
  const [results, setResults] = React.useState<VetSearchResult[]>([]);
  const [scoped, setScoped] = React.useState(false);
  const [serverType, setServerType] = React.useState<VetDetectedType | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [highlight, setHighlight] = React.useState(0);
  const [recents, setRecents] = React.useState<VetRecentLookup[]>([]);

  const localType = React.useMemo(() => detectVetQuery(value), [value]);
  const detected = serverType ?? localType;
  const trimmed = value.trim();

  React.useEffect(() => setRecents(readRecentLookups()), []);

  /* ── The lookup ─────────────────────────────────────────────────────────── */

  const runSearch = React.useCallback(
    async (q: string, opts?: { navigateOnSingle?: boolean }) => {
      const query = q.trim();
      if (!query || !orgId || !allowed) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++seqRef.current;

      setStatus("loading");
      setError(null);
      try {
        const res = await api.searchPatients(query, { signal: controller.signal });
        if (seq !== seqRef.current) return; // a newer keystroke already won
        setResults(res.results ?? []);
        setScoped(!!res.scoped);
        setServerType(res.detectedType ?? null);
        setHighlight(0);
        setStatus("done");
        setOpen(true);

        // A scan (or an exact identifier) that resolves to exactly one cat is
        // the five-second answer — go straight there rather than making someone
        // confirm a list of one.
        const only = res.results?.length === 1 ? res.results[0] : null;
        if (opts?.navigateOnSingle && only) {
          openPatient(only);
        }
      } catch (err) {
        if (seq !== seqRef.current || controller.signal.aborted) return;
        setStatus("error");
        setResults([]);
        setError(vetFriendlyError(err, isAr).message);
        setOpen(true);
      }
    },
    // openPatient is declared below and is stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, allowed, isAr, orgId],
  );

  const openPatient = React.useCallback(
    (r: Pick<VetSearchResult, "catId" | "name" | "catIdNumber" | "photoUrl">) => {
      setRecents(
        pushRecentLookup({
          catId: r.catId,
          name: r.name,
          catIdNumber: r.catIdNumber,
          photoUrl: r.photoUrl ?? null,
        }),
      );
      setOpen(false);
      router.push(`/vet/patients/${encodeURIComponent(r.catId)}`);
    },
    [router],
  );

  /* ── Debounce ───────────────────────────────────────────────────────────── */

  React.useEffect(() => {
    if (!trimmed) {
      abortRef.current?.abort();
      seqRef.current++;
      setResults([]);
      setStatus("idle");
      setError(null);
      setServerType(null);
      return;
    }
    // A name is scoped and fuzzy — wait for a couple of characters. An exact
    // identifier is worth firing immediately.
    if (!isExactIdentifier(localType) && trimmed.length < MIN_NAME_CHARS) {
      setStatus("typing");
      return;
    }
    setStatus("typing");
    const t = setTimeout(() => void runSearch(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [trimmed, localType, runSearch]);

  /* ── Global keyboard: `/` to focus, and the scanner wedge ───────────────── */

  React.useEffect(() => {
    if (!allowed) return;

    let buffer = "";
    let last = 0;

    const isTypingTarget = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // `/` focuses the box from anywhere — the spine is one keystroke away.
      if (e.key === "/" && !isTypingTarget(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      // ── Wedge scanner: machine-speed keystrokes, wherever focus happens to be.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const now = Date.now();
      const gap = now - last;
      last = now;

      if (e.key === "Enter") {
        if (buffer.length >= WEDGE_MIN_LENGTH && gap < WEDGE_MAX_GAP_MS * 4) {
          const scanned = buffer;
          buffer = "";
          // The scanner may have been typing into another field; the lookup
          // always wins, and the box shows what was read.
          e.preventDefault();
          setValue(scanned);
          setOpen(true);
          inputRef.current?.focus();
          void runSearch(scanned, { navigateOnSingle: true });
          return;
        }
        buffer = "";
        return;
      }

      if (e.key.length !== 1) {
        if (e.key !== "Shift") buffer = "";
        return;
      }
      buffer = gap > WEDGE_MAX_GAP_MS ? e.key : buffer + e.key;
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [allowed, runSearch]);

  /* ── Dismiss on outside click ───────────────────────────────────────────── */

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  /* ── Keyboard within the box ────────────────────────────────────────────── */

  const showRecents = open && !trimmed && recents.length > 0;
  const options: (VetSearchResult | VetRecentLookup)[] = showRecents ? recents : results;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => {
        const next = e.key === "ArrowDown" ? h + 1 : h - 1;
        return (next + options.length) % options.length;
      });
      return;
    }
    if (e.key === "Enter") {
      const pick = options[highlight];
      if (pick) {
        e.preventDefault();
        openPatient(pick);
      } else if (trimmed) {
        e.preventDefault();
        void runSearch(trimmed, { navigateOnSingle: true });
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      // Esc closes; it never eats what was typed (R117).
      if (open) setOpen(false);
      else inputRef.current?.blur();
    }
  };

  if (!allowed) return null;

  const listId = "vet-omnibox-results";

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-xl border bg-background ps-3 pe-2 shadow-e1 transition-shadow",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-background",
          open ? "border-primary/40" : "border-input",
        )}
      >
        {status === "loading" ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <input
          ref={inputRef}
          value={value}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options.length ? `${listId}-${highlight}` : undefined}
          aria-label={isAr ? "ابحث عن قط" : "Find a cat"}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={
            isAr ? "رقم الهوية، الجوال، الشريحة، أو الاسم…" : "Cat ID, phone, microchip, or name…"
          }
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setServerType(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        {trimmed && (
          <>
            <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
              {vetDetectedTypeLabel(detected, isAr)}
            </Badge>
            <button
              type="button"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
              }}
              aria-label={isAr ? "مسح البحث" : "Clear search"}
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden />
            </button>
          </>
        )}
        {!trimmed && (
          <kbd className="hidden shrink-0 rounded-md border border-border px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground sm:block">
            /
          </kbd>
        )}
      </div>

      {open && (
        <div
          className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-e3"
          id={listId}
          role="listbox"
          aria-label={isAr ? "نتائج البحث" : "Search results"}
        >
          {showRecents && (
            <>
              <p className="flex items-center gap-1.5 px-2.5 py-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                <Clock className="size-3" aria-hidden />
                {isAr ? "آخر من بحثت عنهم" : "Recent lookups"}
              </p>
              {recents.map((r, i) => (
                <ResultRow
                  key={r.catId}
                  id={`${listId}-${i}`}
                  active={i === highlight}
                  onSelect={() => openPatient(r)}
                  onHover={() => setHighlight(i)}
                  name={r.name}
                  catIdNumber={r.catIdNumber}
                  photoUrl={r.photoUrl}
                />
              ))}
            </>
          )}

          {!showRecents && status === "typing" && trimmed.length < MIN_NAME_CHARS && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {isAr ? "أكمل حرفاً آخر…" : "Keep typing…"}
            </p>
          )}

          {!showRecents && status === "loading" && (
            <div className="space-y-1.5 p-1.5" aria-live="polite">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
                  <div className="size-11 shrink-0 animate-pulse rounded-xl bg-muted" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
              <p className="px-2.5 pb-1 text-[0.6875rem] text-muted-foreground">
                {isAr ? "نتحقق من العضوية…" : "Checking membership…"}
              </p>
            </div>
          )}

          {!showRecents && status === "error" && (
            <div className="px-3 py-4 text-center" role="alert">
              <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void runSearch(trimmed)}
                className="mt-2 min-h-[44px] text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isAr ? "أعد المحاولة" : "Try again"}
              </button>
            </div>
          )}

          {!showRecents && status === "done" && results.length > 0 && (
            <>
              {scoped && (
                <p className="flex items-start gap-1.5 px-2.5 py-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-px size-3 shrink-0" aria-hidden />
                  {isAr
                    ? "البحث بالاسم يشمل مرضى عيادتك فقط."
                    : "Name search covers your clinic's own patients only."}
                </p>
              )}
              {results.map((r, i) => (
                <ResultRow
                  key={r.catId}
                  id={`${listId}-${i}`}
                  active={i === highlight}
                  onSelect={() => openPatient(r)}
                  onHover={() => setHighlight(i)}
                  name={r.name}
                  catIdNumber={r.catIdNumber}
                  photoUrl={r.photoUrl}
                  meta={
                    <>
                      {r.ownerName && <span className="truncate">{r.ownerName}</span>}
                      {r.lastVisitAt && (
                        <span className="truncate">
                          {isAr ? "آخر زيارة " : "last visit "}
                          {formatDate(r.lastVisitAt, isAr ? "ar" : "en")}
                        </span>
                      )}
                    </>
                  }
                  trailing={
                    r.isOwnPatient ? (
                      <Badge variant="secondary">{isAr ? "من مرضاك" : "Your patient"}</Badge>
                    ) : null
                  }
                />
              ))}
            </>
          )}

          {!showRecents && status === "done" && results.length === 0 && (
            <NoMatch isAr={isAr} detected={detected} />
          )}

          {!showRecents && status === "idle" && !trimmed && (
            <p className="px-3 py-5 text-center text-xs leading-relaxed text-muted-foreground">
              {isAr
                ? "امسح بطاقة العضو، أو اكتب رقم الهوية أو الجوال أو الشريحة — أو اسم قط تعرفه العيادة."
                : "Scan a member's card, or type a Cat ID, phone or microchip — or the name of a cat this clinic knows."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The boundary, said warmly: a principle protecting members, not a dead end. */
function NoMatch({ isAr, detected }: { isAr: boolean; detected: VetDetectedType }) {
  const exact = isExactIdentifier(detected);
  return (
    <div className="px-4 py-6 text-center">
      <p className="text-sm font-medium">{isAr ? "ما لقينا تطابقاً" : "No match for that here"}</p>
      <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
        {exact
          ? isAr
            ? "تأكد من الرقم — قد يكون فيه خانة ناقصة. إذا كان العضو أمامك، امسح بطاقته وسيُقرأ فوراً."
            : "Double-check the number — a digit may be off. If the member is with you, scanning their card reads it exactly."
          : isAr
            ? "البحث بالاسم يشمل القطط التي عالجتها عيادتك — وهذه حماية لبقية الأعضاء، لا نقص في النظام. إذا كان العضو أمامك، امسح بطاقته أو اكتب رقم هويته أو جواله."
            : "Name search reaches the cats your clinic has treated — a boundary that protects every other member, not a limitation. If the member is with you, scan their card or enter their Cat ID or phone."}
      </p>
    </div>
  );
}

function ResultRow({
  id,
  active,
  onSelect,
  onHover,
  name,
  catIdNumber,
  photoUrl,
  meta,
  trailing,
}: {
  id: string;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
  name: string;
  catIdNumber?: string | null;
  photoUrl?: string | null;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      onClick={onSelect}
      onMouseMove={onHover}
      className={cn(
        "flex min-h-[56px] w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors",
        active ? "bg-primary/10" : "hover:bg-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted" aria-hidden>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="text-base">🐈</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-sm font-medium leading-tight">{name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-muted-foreground">
          {catIdNumber && <span className="font-mono tabular">{catIdNumber}</span>}
          {meta}
        </span>
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}
