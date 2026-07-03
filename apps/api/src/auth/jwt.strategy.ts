import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";
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
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? "change-me-access-secret",
    });
  }

  /** Runs on every authenticated request; the return value becomes req.user. */
  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, email: true, isStaff: true, status: true },
    });
    if (!user || user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
      throw new UnauthorizedException("Account is not active");
    }
    return { id: user.id, email: user.email, isStaff: user.isStaff };
  }
}
