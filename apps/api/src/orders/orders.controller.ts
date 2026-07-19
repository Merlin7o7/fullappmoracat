import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Commercial } from "../common/decorators/commercial.decorator";

@ApiTags("orders")
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // Orders and invoices are the ledger of a commerce era that hasn't started —
  // grandTotal, VAT, payment amounts. Gated, not deleted: flipping COMMERCE_ENABLED
  // hands every member their receipts back untouched (R024/R064). Unlike a
  // subscription a member is living inside, there is nothing here to be locked
  // out of while nothing has ever been sold.
  @Get("orders")
  @Commercial()
  @ApiOperation({ summary: "List the current user's orders" })
  list(@CurrentUser("id") userId: string) {
    return this.orders.list(userId);
  }

  @Get("orders/:orderNumber")
  @Commercial()
  @ApiOperation({ summary: "Get one order with items, payment, shipment, invoice" })
  detail(@CurrentUser("id") userId: string, @Param("orderNumber") orderNumber: string) {
    return this.orders.detail(userId, orderNumber);
  }

  @Get("invoices")
  @Commercial()
  @ApiOperation({ summary: "List the current user's invoices" })
  invoices(@CurrentUser("id") userId: string) {
    return this.orders.invoices(userId);
  }
}
