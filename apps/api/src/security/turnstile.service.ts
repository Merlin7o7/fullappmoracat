import { Injectable, Logger } from "@nestjs/common";

/**
 * Cloudflare Turnstile verification — proof-of-humanity for the census.
 *
 * The census's entire brand claim is «this number is real» (R006/R040). The
 * display side is honest by construction (census.service reports what the DB
 * says); this is the *input* side — the defence that keeps a scripted actor
 * from stuffing the DB with fictional cats in the first place.
 *
 * Env-gated on purpose: with `TURNSTILE_SECRET_KEY` unset (local dev, CI, and
 * any environment that hasn't provisioned Turnstile yet) `verify()` returns
 * true and the guard is a no-op, so first value is never blocked by missing
 * infra. The moment ops sets the secret (and the matching
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY on the web widget) it turns on with zero code
 * change. Fails *open* only when unconfigured, never when Cloudflare is
 * unreachable — a reachability error is treated as a failed challenge.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  private static readonly ENDPOINT =
    "https://challenges.cloudflare.com/turnstile/v0/siteverify";

  /** Whether human-verification is actually enforced in this environment. */
  get enabled(): boolean {
    return this.secret.length > 0;
  }

  /**
   * Verify a Turnstile token. Returns true when verification is disabled
   * (no secret) so the guard no-ops; otherwise asks Cloudflare and returns the
   * real verdict. A missing token or a network/parse error is a failure — we
   * never let an unverifiable request through once enforcement is on.
   */
  async verify(token: string | undefined, remoteIp?: string): Promise<boolean> {
    if (!this.enabled) return true;
    if (!token) return false;

    try {
      const body = new URLSearchParams({ secret: this.secret, response: token });
      if (remoteIp) body.set("remoteip", remoteIp);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(TurnstileService.ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
      if (!data.success) {
        this.logger.warn(
          `Turnstile challenge failed: ${(data["error-codes"] ?? []).join(",") || "unknown"}`
        );
      }
      return data.success === true;
    } catch (err) {
      // Treat an unreachable/blocked verifier as a failed challenge once
      // enforcement is on — better a rare false-negative on the front door than
      // a hole in the census-integrity wall.
      this.logger.error(`Turnstile verification error: ${(err as Error).message}`);
      return false;
    }
  }
}
