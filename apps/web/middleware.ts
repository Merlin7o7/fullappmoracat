import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware. Two responsibilities:
 *
 * 1. **Content Security Policy.** A per-request nonce is minted here and handed
 *    to Next via the `x-nonce` header; Next stamps it onto its own inline
 *    bootstrap scripts, and `strict-dynamic` lets those scripts load the rest of
 *    the bundle. This is the defence-in-depth layer behind output escaping: even
 *    if a string escapes sanitisation somewhere, injected script has no valid
 *    nonce and will not execute.
 *
 * 2. **Route guarding.** The API is the real authorisation boundary (every
 *    /portal, /admin and /vet data call is JWT-checked server-side). This stops
 *    the app serving protected shells to anonymous visitors and bounces them to
 *    the right login with a `next` param. Presence is signalled by the
 *    non-secret `mrc_auth` cookie; it carries no token.
 */

// The vet portal is protected too, EXCEPT its three public doors: a clinic
// applying to join, a staff member signing in, and an invited colleague
// accepting their invitation. Everything behind those is patient data.
const PROTECTED = [/^\/portal(\/|$)/, /^\/admin(\/|$)/, /^\/vet(\/|$)/];
const PUBLIC_VET = [/^\/vet\/login(\/|$)/, /^\/vet\/apply(\/|$)/, /^\/vet\/invite(\/|$)/];

const IS_PROD = process.env.NODE_ENV === "production";

/** Origins the browser is allowed to talk to. Keep in sync with next.config remotePatterns. */
function connectOrigins(): string[] {
  const out = new Set<string>(["'self'"]);
  const api = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (api) {
    try {
      out.add(new URL(api).origin);
    } catch {
      /* malformed API base — fall through to same-origin only */
    }
  }
  // Sentry ingest is a per-project subdomain; allow the org ingest host only.
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    try {
      out.add(new URL(dsn).origin);
    } catch {
      /* ignore */
    }
  }
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (posthog) {
    try {
      out.add(new URL(posthog).origin);
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

const IMAGE_HOSTS = [
  "'self'",
  "data:",
  "blob:",
  "https://*.r2.dev",
  "https://*.r2.cloudflarestorage.com",
  "https://lh3.googleusercontent.com",
];

function buildCsp(nonce: string): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // strict-dynamic: trust is propagated from the nonced bootstrap to the
    // chunks it loads, so we never need 'unsafe-inline' or host allow-lists for
    // scripts. Older browsers ignore strict-dynamic and fall back to 'self'.
    // Dev only: next dev's eval-based sourcemaps and react-refresh need
    // unsafe-eval — without it hydration dies silently in `pnpm dev`. Never prod.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(IS_PROD ? [] : ["'unsafe-eval'"])],
    // Tailwind emits a stylesheet, but Next and framer-motion also set inline
    // style attributes. style-src-attr must stay permissive for those; the
    // stylesheet itself is same-origin. Inline styles cannot execute script.
    "style-src": ["'self'", "'unsafe-inline'"],
    "style-src-attr": ["'unsafe-inline'"],
    "img-src": IMAGE_HOSTS,
    "font-src": ["'self'", "data:"],
    "connect-src": connectOrigins(),
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'", "blob:", "data:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
  };

  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (IS_PROD) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  const isPublicVet = PUBLIC_VET.some((re) => re.test(pathname));
  const needsAuth = !isPublicVet && PROTECTED.some((re) => re.test(pathname));
  const authed = req.cookies.get("mrc_auth")?.value === "1";

  if (needsAuth && !authed) {
    const login = req.nextUrl.clone();
    // Clinic staff sign in at their own door, so the bounce keeps them in the
    // vet context instead of dropping them on the member login.
    login.pathname = pathname.startsWith("/vet") ? "/vet/login" : "/login";
    login.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(login);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  // Forward the nonce so Next can stamp its inline scripts, and so server
  // components can read it via headers() when they need to inline anything.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    /*
     * Every route except static assets and image-optimizer output, which are
     * served straight from the CDN and need no policy header. Prefetches are
     * deliberately NOT excluded: skipping them would leave RSC payloads for
     * protected routes ungated and document responses without a CSP.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|otf|ttf|woff|woff2)$).*)",
  ],
};
