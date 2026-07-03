import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("orders")
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get("orders")
  @ApiOperation({ summary: "List the current user's orders" })
  list(@CurrentUser("id") userId: string) {
    return this.orders.list(userId);
  }

  @Get("orders/:orderNumber")
  @ApiOperation({ summary: "Get one order with items, payment, shipment, invoice" })
  detail(@CurrentUser("id") userId: string, @Param("orderNumber") orderNumber: string) {
    return this.orders.detail(userId, orderNumber);
  }

  @Get("invoices")
  @ApiOperation({ summary: "List the current user's invoices" })
  invoices(@CurrentUser("id") userId: string) {
    return this.orders.invoices(userId);
  }
}
