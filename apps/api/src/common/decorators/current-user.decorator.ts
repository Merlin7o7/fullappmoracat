import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  id: string;
  email: string;
  isStaff: boolean;
  /** Whether the account's email OTP has been confirmed (gates UGC writes). */
  emailVerified: boolean;
}

/**
 * Injects the authenticated user (populated by JwtStrategy.validate).
 *
 * Optional-chained on purpose: routes marked `@OptionalAuth()` legitimately run
 * with no user, and `request.user[data]` would throw there. On a guarded route
 * the guard has already rejected the request, so this can never be undefined.
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthUser | undefined,
    ctx: ExecutionContext
  ): AuthUser | AuthUser[keyof AuthUser] | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return data ? request.user?.[data] : request.user;
  }
);
