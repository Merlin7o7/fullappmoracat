/**
 * Turns the real portal into a self-contained demo — no API, no database, no
 * secrets — by intercepting `fetch` in the browser and answering from
 * `handleDemoRequest`. Enabled only when `NEXT_PUBLIC_VET_DEMO === "1"`, so a
 * normal build is completely untouched.
 *
 * It also pre-authenticates a demo staff session so a visitor lands straight in
 * a working clinic, and seeds the `mrc_auth` cookie the edge middleware reads.
 */

import { handleDemoRequest, resetDemoStore } from "./engine";
import { DEFAULT_STAFF_ID, ORG, staffById } from "./data";

/** Build-time flag. Inlined by Next, so dead-code-eliminated when off. */
export const DEMO_ENABLED = process.env.NEXT_PUBLIC_VET_DEMO === "1";

const AUTH_KEY = "moraqat.auth";
const ORG_KEY = "moraqat.vet.org";

/** A believable network feel — long enough to see a spinner, short enough to fly. */
const LATENCY_MS = 110;

let installed = false;

function headerObject(input: RequestInfo | URL, init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (h: HeadersInit | undefined) => {
    if (!h) return;
    if (h instanceof Headers) h.forEach((v, k) => (out[k.toLowerCase()] = v));
    else if (Array.isArray(h)) h.forEach(([k, v]) => (out[k.toLowerCase()] = v));
    else for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
  };
  if (input instanceof Request) add(input.headers);
  add(init?.headers);
  return out;
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method;
  if (input instanceof Request) return input.method;
  return "GET";
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  const b = init?.body;
  if (typeof b !== "string" || !b) return {};
  try {
    const parsed = JSON.parse(b);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Patch window.fetch so every `/api/*` call is answered locally. */
function patchFetch() {
  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let pathname: string;
    let search = "";
    try {
      const u = new URL(urlOf(input), window.location.origin);
      pathname = u.pathname;
      search = u.search;
    } catch {
      return original(input as RequestInfo, init);
    }

    const apiIdx = pathname.indexOf("/api/");
    if (apiIdx === -1) return original(input as RequestInfo, init);

    const enginePath = pathname.slice(apiIdx + 4); // strip ".../api"
    const isVetOrAuth = enginePath.startsWith("/vet") || enginePath.startsWith("/auth");

    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const timer = setTimeout(() => {
        if (!isVetOrAuth) {
          resolve(jsonResponse(503, { code: "DEMO_ONLY", message: "This surface isn't part of the vet demo." }));
          return;
        }
        try {
          const query = new URLSearchParams(search);
          const result = handleDemoRequest(
            methodOf(input, init),
            enginePath,
            query,
            parseBody(init),
            headerObject(input, init),
          );
          resolve(jsonResponse(result.status, result.body));
        } catch (err) {
          resolve(jsonResponse(500, { code: "DEMO_ERROR", message: String(err) }));
        }
      }, LATENCY_MS);

      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  };
}

/** Pre-authenticate a demo staff session so /vet opens straight into the clinic. */
function seedSession() {
  try {
    if (!localStorage.getItem(AUTH_KEY)) {
      const staff = staffById(DEFAULT_STAFF_ID);
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          user: {
            id: staff.id,
            email: staff.email,
            firstName: staff.first,
            lastName: staff.last,
            locale: "ar",
            status: "ACTIVE",
            isStaff: true,
            emailVerified: true,
          },
          tokens: { accessToken: `demo:${staff.id}`, refreshToken: `demo:${staff.id}` },
        }),
      );
      localStorage.setItem(ORG_KEY, ORG.id);
    }
    // The edge middleware gates /vet on this non-secret presence cookie.
    document.cookie = `mrc_auth=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  } catch {
    /* private mode — the portal still works, it just won't auto-forward */
  }
}

/** Idempotent: install the demo runtime. Safe to call from module scope. */
export function installVetDemo(): void {
  if (!DEMO_ENABLED || typeof window === "undefined" || installed) return;
  installed = true;
  patchFetch();
  seedSession();
}

/** Reset the clinic to its opening state and reload — used by the demo ribbon. */
export function resetVetDemo(): void {
  resetDemoStore();
  try {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(ORG_KEY);
    localStorage.removeItem("moraqat.vet.recents");
  } catch {
    /* ignore */
  }
  window.location.href = "/vet";
}
