import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_EMAIL_VERIFIED_KEY } from "../decorators/email-verified.decorator";
import type { AuthUser } from "../decorators/current-user.decorator";

/**
 * Global guard (default-allow). Only routes/controllers marked
 * @RequireEmailVerified are gated: the authenticated member must have a
 * confirmed email. Runs after JwtAuthGuard, so req.user is populated. Public
 * routes are never marked, so they pass straight through.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_EMAIL_VERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (user?.emailVerified) return true;

    throw new ForbiddenException({
      code: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email to continue.",
    });
  }
}
