import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";
import { resolveJwtSecret } from "../common/config/secrets";
import type { AuthUser } from "../common/decorators/current-user.decorator";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  isStaff: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret("JWT_ACCESS_SECRET"),
    });
  }

  /** Runs on every authenticated request; the return value becomes req.user. */
  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, email: true, isStaff: true, status: true, emailVerified: true },
    });
    if (!user || user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      throw new UnauthorizedException("Account is not active");
    }
    // emailVerified travels on req.user so EmailVerifiedGuard can gate UGC writes
    // server-side (the portal's client redirect is not a security boundary).
    return { id: user.id, email: user.email, isStaff: user.isStaff, emailVerified: !!user.emailVerified };
  }
}
