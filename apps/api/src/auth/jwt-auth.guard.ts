import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator";
import { IS_OPTIONAL_AUTH_KEY } from "../common/decorators/optional-auth.decorator";

/**
 * Global authentication guard. Protects every route by default; routes marked
 * with @Public() are allowed through, and routes marked with @OptionalAuth()
 * run either way but still resolve `req.user` when a valid token is present.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  private flag(key: string, context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]) ??
      false
    );
  }

  override canActivate(context: ExecutionContext) {
    if (this.flag(IS_PUBLIC_KEY, context)) return true;
    // Stash the flag so handleRequest below knows whether a missing/invalid
    // credential is fatal or simply means "anonymous".
    (context.switchToHttp().getRequest() as { __optionalAuth?: boolean }).__optionalAuth = this.flag(
      IS_OPTIONAL_AUTH_KEY,
      context
    );
    return super.canActivate(context);
  }

  /**
   * Passport throws by default when no user is resolved. For optional-auth
   * routes an absent, malformed or expired token is a legitimate anonymous
   * request — return `undefined` instead of 401 so the handler can decide.
   */
  override handleRequest<TUser>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext
  ): TUser {
    const req = context.switchToHttp().getRequest() as { __optionalAuth?: boolean };
    if (req.__optionalAuth && (err || !user)) return undefined as TUser;
    return super.handleRequest(err, user, info, context);
  }
}
