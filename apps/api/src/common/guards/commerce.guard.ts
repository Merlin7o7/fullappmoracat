import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_COMMERCIAL_KEY } from "../decorators/commercial.decorator";
import { commerceEnabled } from "../config/features";

/**
 * Community-Mode kill-switch (global). Any handler or controller marked
 * @Commercial is blocked with a graceful, machine-readable 403 while commerce
 * is disabled — checkout, paid subscriptions, and payment surfaces are simply
 * not reachable. Everything else passes straight through, so the guard is
 * default-allow and cannot accidentally lock the community product.
 */
@Injectable()
export class CommerceGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isCommercial = this.reflector.getAllAndOverride<boolean>(IS_COMMERCIAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isCommercial || commerceEnabled()) return true;

    throw new ForbiddenException({
      code: "MEMBERSHIPS_COMING_SOON",
      message: "Memberships are launching soon.",
    });
  }
}
