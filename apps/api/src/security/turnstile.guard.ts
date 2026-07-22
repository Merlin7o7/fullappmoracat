import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
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
  constructor(private readonly turnstile: TurnstileService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.turnstile.enabled) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers["x-turnstile-token"];
    const token = Array.isArray(header) ? header[0] : header;

    const ok = await this.turnstile.verify(token, req.ip);
    if (!ok) {
      // Named code so the client can prompt a fresh challenge rather than
      // showing a generic error (R084 — say what to do next).
      throw new ForbiddenException({ code: "HUMAN_VERIFICATION_REQUIRED" });
    }
    return true;
  }
}
