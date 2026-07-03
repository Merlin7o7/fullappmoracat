import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { PERMISSIONS_KEY } from "../common/decorators/permissions.decorator";
import type { AuthUser } from "../common/decorators/current-user.decorator";

/**
 * Enforces @RequirePermissions on staff routes. No-op for routes without the
 * decorator (so customer/public routes are unaffected). Runs after the global
 * JwtAuthGuard, so req.user is already populated.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // not a guarded route

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException("Authentication required");
    if (!user.isStaff) throw new ForbiddenException("Staff access required");

    const grants = await this.prisma.permission.findMany({
      where: { roles: { some: { role: { users: { some: { userId: user.id } } } } } },
      select: { key: true },
    });
    const owned = new Set(grants.map((g) => g.key));
    const missing = required.filter((p) => !owned.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission(s): ${missing.join(", ")}`);
    }
    return true;
  }
}
