import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { CartService } from "./cart.service";
import { AddItemDto, ApplyCouponDto, UpdateItemDto } from "./dto/cart.dto";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("cart")
@Public() // carts work for guests; checkout requires auth
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post()
  @ApiOperation({ summary: "Create a new (guest or user) cart" })
  create() {
    return this.cart.create();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a cart with live totals" })
  get(@Param("id") id: string) {
    return this.cart.get(id);
  }

  @Post(":id/items")
  @ApiOperation({ summary: "Add an item to the cart" })
  addItem(@Param("id") id: string, @Body() dto: AddItemDto) {
    return this.cart.addItem(id, dto.productId, dto.quantity ?? 1);
  }

  @Patch(":id/items/:itemId")
  @ApiOperation({ summary: "Update an item quantity (0 removes it)" })
  updateItem(@Param("id") id: string, @Param("itemId") itemId: string, @Body() dto: UpdateItemDto) {
    return this.cart.updateItem(id, itemId, dto.quantity);
  }

  @Delete(":id/items/:itemId")
  @ApiOperation({ summary: "Remove an item" })
  removeItem(@Param("id") id: string, @Param("itemId") itemId: string) {
    return this.cart.removeItem(id, itemId);
  }

  @Post(":id/coupon")
  @ApiOperation({ summary: "Apply a coupon code" })
  applyCoupon(@Param("id") id: string, @Body() dto: ApplyCouponDto) {
    return this.cart.applyCoupon(id, dto.code);
  }

  @Delete(":id/coupon")
  @ApiOperation({ summary: "Remove the applied coupon" })
  removeCoupon(@Param("id") id: string) {
    return this.cart.removeCoupon(id);
  }
}
