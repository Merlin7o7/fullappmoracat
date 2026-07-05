import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AdminAnalyticsService } from "./analytics.service";
import { AdminCustomersService } from "./customers.service";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminProductsService } from "./admin-products.service";
import { CreateProductDto, UpdateProductDto } from "./admin-products.dto";
import { RefundsService } from "../payments/refunds.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Commercial } from "../common/decorators/commercial.decorator";

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
export class AdminController {
  constructor(
    private readonly analytics: AdminAnalyticsService,
    private readonly customers: AdminCustomersService,
    private readonly orders: AdminOrdersService,
    private readonly products: AdminProductsService,
    private readonly refunds: RefundsService
  ) {}

  // ── Analytics ─────────────────────────────────────────────────────────
  @Get("dashboard")
  @RequirePermissions("dashboard.read")
  @ApiOperation({ summary: "Admin analytics dashboard" })
  dashboard() {
    return this.analytics.dashboard();
  }

  // ── Customers ─────────────────────────────────────────────────────────
  @Get("customers")
  @RequirePermissions("customers.read")
  @ApiOperation({ summary: "List customers" })
  listCustomers(@Query("page") page?: string, @Query("search") search?: string) {
    return this.customers.list(page ? Number(page) : 1, 20, search);
  }

  @Get("customers/:id")
  @RequirePermissions("customers.read")
  @ApiOperation({ summary: "Customer detail" })
  customer(@Param("id") id: string) {
    return this.customers.detail(id);
  }

  // ── Orders ────────────────────────────────────────────────────────────
  @Get("orders")
  @RequirePermissions("orders.read")
  @ApiOperation({ summary: "List all orders" })
  listOrders(@Query("page") page?: string, @Query("status") status?: string) {
    return this.orders.list(page ? Number(page) : 1, 20, status);
  }

  @Patch("orders/:orderNumber/status")
  @RequirePermissions("orders.write")
  @ApiOperation({ summary: "Update an order's status" })
  updateOrderStatus(
    @CurrentUser("id") actorId: string,
    @Param("orderNumber") orderNumber: string,
    @Body("status") status: string
  ) {
    return this.orders.updateStatus(actorId, orderNumber, status);
  }

  @Post("orders/:orderNumber/refund")
  @Commercial() // Community Mode: no payment/refund surface is reachable.
  @RequirePermissions("payments.write")
  @ApiOperation({ summary: "Refund an order (full when amount omitted, else partial)" })
  refundOrder(
    @CurrentUser("id") actorId: string,
    @Param("orderNumber") orderNumber: string,
    @Body() body: { amount?: number; reason?: string }
  ) {
    return this.refunds.refundOrder(actorId, orderNumber, body?.amount, body?.reason);
  }

  // ── Products ──────────────────────────────────────────────────────────
  @Get("products")
  @RequirePermissions("products.read")
  @ApiOperation({ summary: "List products (incl. inactive)" })
  listProducts(@Query("page") page?: string, @Query("search") search?: string) {
    return this.products.list(page ? Number(page) : 1, 20, search);
  }

  @Post("products")
  @RequirePermissions("products.write")
  @ApiOperation({ summary: "Create a product" })
  createProduct(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch("products/:id")
  @RequirePermissions("products.write")
  @ApiOperation({ summary: "Update a product" })
  updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Patch("products/:id/toggle")
  @RequirePermissions("products.write")
  @ApiOperation({ summary: "Toggle a product active/inactive" })
  toggleProduct(@Param("id") id: string) {
    return this.products.toggleActive(id);
  }
}
