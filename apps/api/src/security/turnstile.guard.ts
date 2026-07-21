import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import type { Request } from "express";
import { TurnstileService } from "./turnstile.service";

/**
 * Route guard that requires a valid Turnstile token on the request.
 *
 * Applied to the two front-door writes that decide the census's honesty:
 * account registration and cat creation. The web client sends the token in the
 * `x-turnstile-token` header (see the <TurnstileWidget/>). When Turnstile is
 * not configured the underlying service returns true, so this guard is a
 * transparent no-op — no env, no friction — until ops turns it on.
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  private readonly logger = new Logger(TurnstileGuard.name);

  constructor(private readonly turnstile: TurnstileService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.turnstile.enabled) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers["x-turnstile-token"];
    const token = Array.isArray(header) ? header[0] : header;

    const ok = await this.turnstile.verify(token, req.ip);
    if (ok) return true;

    // The check failed. Only BLOCK when explicitly enforcing — otherwise
    // fail-open: never let a hung/misconfigured widget stop a real person from
    // registering. The census stays protected by the throttle, the daily cap,
    // and the integrity audit either way.
    if (this.turnstile.enforcing) {
      // Named code so the client can prompt a fresh challenge (R084).
      throw new ForbiddenException({ code: "HUMAN_VERIFICATION_REQUIRED" });
    }
    this.logger.warn(
      `Turnstile check failed but not enforcing (fail-open) — token ${
        token ? "present-but-invalid" : "missing"
      }. Set TURNSTILE_ENFORCE=true once the widget is verified on the live domain.`
    );
    return true;
  }
}
