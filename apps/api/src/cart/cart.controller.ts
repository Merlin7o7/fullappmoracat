import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiHeader } from "@nestjs/swagger";
import { CartService, type CartActor } from "./cart.service";
import { AddItemDto, ApplyCouponDto, UpdateItemDto } from "./dto/cart.dto";
import { OptionalAuth } from "../common/decorators/optional-auth.decorator";
import { CurrentCartActor, CART_TOKEN_HEADER } from "./cart-actor.decorator";

/**
 * Carts work for guests AND signed-in members, so the whole controller is
 * optional-auth rather than @Public(): an anonymous shopper is allowed through,
 * but when a bearer token IS present we resolve the user so the cart can be
 * owned and claimed. Authorisation itself lives in CartService.requireAccess —
 * a cart id is never sufficient on its own.
 */
@ApiTags("cart")
@OptionalAuth()
@ApiHeader({
  name: CART_TOKEN_HEADER,
  required: false,
  description: "Guest cart capability token, returned once when the cart is created.",
})
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post()
  @ApiOperation({ summary: "Create a cart (guest carts return a one-time capability token)" })
  create(@CurrentCartActor() actor: CartActor) {
    return this.cart.create(actor);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a cart with live totals" })
  get(@Param("id") id: string, @CurrentCartActor() actor: CartActor) {
    return this.cart.get(id, actor);
  }

  @Post(":id/items")
  @ApiOperation({ summary: "Add an item to the cart" })
  addItem(@Param("id") id: string, @CurrentCartActor() actor: CartActor, @Body() dto: AddItemDto) {
    return this.cart.addItem(id, actor, dto.productId, dto.quantity ?? 1);
  }

  @Patch(":id/items/:itemId")
  @ApiOperation({ summary: "Update an item quantity (0 removes it)" })
  updateItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @CurrentCartActor() actor: CartActor,
    @Body() dto: UpdateItemDto
  ) {
    return this.cart.updateItem(id, actor, itemId, dto.quantity);
  }

  @Delete(":id/items/:itemId")
  @ApiOperation({ summary: "Remove an item" })
  removeItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @CurrentCartActor() actor: CartActor
  ) {
    return this.cart.removeItem(id, actor, itemId);
  }

  @Post(":id/coupon")
  @ApiOperation({ summary: "Apply a coupon code" })
  applyCoupon(
    @Param("id") id: string,
    @CurrentCartActor() actor: CartActor,
    @Body() dto: ApplyCouponDto
  ) {
    return this.cart.applyCoupon(id, actor, dto.code);
  }

  @Delete(":id/coupon")
  @ApiOperation({ summary: "Remove the applied coupon" })
  removeCoupon(@Param("id") id: string, @CurrentCartActor() actor: CartActor) {
    return this.cart.removeCoupon(id, actor);
  }
}
