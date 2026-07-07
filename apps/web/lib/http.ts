/**
 * Shared HTTP primitives for every client-side call to the API.
 *
 * Two jobs, both in service of "never leave the member staring at a spinner"
 * (R112 — honesty over false calm): (1) every request is bounded by a hard
 * timeout so a stalled network can't produce an infinite loading state, and
 * (2) failures are normalised into a friendly, locale-aware {@link ApiError}
 * the UI can show verbatim and always offer a retry for.
 */

/** Hard ceiling for any single API request. */
export const REQUEST_TIMEOUT_MS = 10_000;

export type ApiErrorKind = "timeout" | "network" | "http" | "auth" | "parse";

/** A normalised, user-safe API failure. `message` is already localized. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

// Arabic is the default experience (R101); fall back to it unless the document
// is explicitly in English. Reading the live <html lang> keeps the message in
// the member's current language without threading locale through every caller.
function preferArabic(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.lang !== "en";
}

/** Localized, user-safe copy for a transient (timeout/network) failure. */
export function friendly(kind: "timeout" | "network"): string {
  const ar = kind === "timeout"
    ? "استغرق الطلب وقتاً طويلاً. تحقّق من اتصالك وحاول مرة أخرى."
    : "تعذّر الوصول إلى الخادم. تحقّق من اتصالك بالإنترنت وحاول مرة أخرى.";
  const en = kind === "timeout"
    ? "The request took too long. Check your connection and try again."
    : "Couldn't reach the server. Check your internet connection and try again.";
  return preferArabic() ? ar : en;
}

/**
 * `fetch` with a hard timeout. On timeout/abort or a network-level failure it
 * rejects with a friendly {@link ApiError} (never hangs). Any caller-supplied
 * `signal` is respected and combined with the timeout.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? anySignal([init.signal, timeout]) : timeout;
  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ApiError(friendly("timeout"), "timeout");
    }
    // fetch rejects with TypeError for DNS/CORS/offline — all "can't reach it".
    throw new ApiError(friendly("network"), "network");
  }
}

/** Combine multiple AbortSignals into one that aborts when any of them does. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = (s: AbortSignal) => () => controller.abort(s.reason);
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener("abort", onAbort(s), { once: true });
  }
  return controller.signal;
}

/**
 * Turn a non-OK Response (with its parsed JSON body, if any) into an ApiError
 * carrying the API's message. Keeps error surfacing consistent across wrappers.
 */
export function httpError(status: number, body: unknown, fallback = "Request failed"): ApiError {
  const b = body as { message?: string | string[] } | null;
  const message = Array.isArray(b?.message) ? b?.message.join(", ") : b?.message;
  const kind: ApiErrorKind = status === 401 || status === 403 ? "auth" : "http";
  return new ApiError(message || `${fallback} (${status})`, kind, status);
}
