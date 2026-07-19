import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { CartActor } from "./cart.service";
import type { AuthUser } from "../common/decorators/current-user.decorator";

/** Header carrying the guest cart capability token. */
export const CART_TOKEN_HEADER = "x-cart-token";

/**
 * Resolves who is acting on a cart: the authenticated owner, the bearer of a
 * guest capability token, or both (a signed-in shopper adopting the basket they
 * built before logging in).
 *
 * Keeping this in one decorator means no controller can forget to thread
 * ownership through — the service simply cannot be called without an actor.
 */
export const CurrentCartActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CartActor => {
    const req = ctx.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const raw = req.headers[CART_TOKEN_HEADER];
    const token = Array.isArray(raw) ? raw[0] : raw;
    return { userId: req.user?.id ?? null, token: token ?? null };
  }
);
