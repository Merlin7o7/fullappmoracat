import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  id: string;
  email: string;
  isStaff: boolean;
  /** Whether the account's email OTP has been confirmed (gates UGC writes). */
  emailVerified: boolean;
}

/** Injects the authenticated user (populated by JwtStrategy.validate). */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return data ? request.user[data] : request.user;
  }
);
