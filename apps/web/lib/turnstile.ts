/**
 * Turnstile token store — the bridge between the challenge widget and the two
 * requests that must carry its proof (registration + cat creation).
 *
 * The widget (components/turnstile-widget.tsx) solves the challenge and drops
 * the resulting token here; `apiPost`/`authedFetch` read it and attach the
 * `x-turnstile-token` header the API's TurnstileGuard checks. Tokens are
 * single-use, so `consumeTurnstileToken` clears on read.
 *
 * All of this is inert unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set: no key →
 * no widget → no token → the (also-disabled) server guard no-ops. First value is
 * never blocked by missing infra.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

let currentToken: string | null = null;

/** Whether Turnstile is configured for the web app. */
export function turnstileEnabled(): boolean {
  return SITE_KEY.length > 0;
}

export function turnstileSiteKey(): string {
  return SITE_KEY;
}

export function setTurnstileToken(token: string | null): void {
  currentToken = token;
}

/** Read and clear the pending token (single-use). Returns null when none/disabled. */
export function consumeTurnstileToken(): string | null {
  const t = currentToken;
  currentToken = null;
  return t;
}
