import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AdminAnalyticsService } from "./analytics.service";
import { AdminAuditService } from "./audit.service";
import { AdminCustomersService } from "./customers.service";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminProductsService } from "./admin-products.service";
import { AdminSubscriptionsService } from "./admin-subscriptions.service";
import { AdminStaffService } from "./staff.service";
import { CreateProductDto, UpdateProductDto } from "./admin-products.dto";
import { RefundsService } from "../payments/refunds.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
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
    private readonly subscriptions: AdminSubscriptionsService,
    private readonly staff: AdminStaffService,
    private readonly refunds: RefundsService,
    private readonly audit: AdminAuditService
  ) {}

  // ── Me ────────────────────────────────────────────────────────────────
  // No @RequirePermissions: every staff member may ask what THEY can do (the
  // nav filters on this). Staff-only is enforced here since the guard only
  // fires on decorated routes.
  @Get("me/permissions")
  @ApiOperation({ summary: "The signed-in staff member's permission keys" })
  myPermissions(@CurrentUser() user: AuthUser) {
    if (!user?.isStaff) throw new ForbiddenException("Staff access required");
    return this.staff.myPermissions(user.id);
  }

  // ── Analytics ─────────────────────────────────────────────────────────
  @Get("dashboard")
  @RequirePermissions("dashboard.read")
  @ApiOperation({ summary: "Admin analytics dashboard" })
  dashboard() {
    return this.analytics.dashboard();
  }

  // ── Audit log (read-only accountability surface) ───────────────────────
  // Gated on settings.read (super-admin/owner/manager/analyst) — an existing
  // permission, so the viewer works on deploy without a re-seed.
  @Get("audit")
  @RequirePermissions("settings.read")
  @ApiOperation({ summary: "Read the audit trail (filter by action prefix / entity / actor)" })
  auditLog(
    @Query("page") page?: string,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("actorId") actorId?: string,
  ) {
    return this.audit.list(page ? Number(page) : 1, { action, entityType, actorId });
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

  @Patch("customers/:id/status")
  @RequirePermissions("customers.write")
  @ApiOperation({ summary: "Suspend or reactivate a customer" })
  setCustomerStatus(
    @CurrentUser("id") actorId: string,
    @Param("id") id: string,
    @Body() body: { action: "suspend" | "reactivate"; reason?: string }
  ) {
    return this.customers.setStatus(actorId, id, body.action, body.reason);
  }

  // ── Orders ────────────────────────────────────────────────────────────
  @Get("orders")
  @RequirePermissions("orders.read")
  @ApiOperation({ summary: "List all orders" })
  listOrders(@Query("page") page?: string, @Query("status") status?: string) {
    return this.orders.list(page ? Number(page) : 1, 20, status);
  }

  @Get("orders/:orderNumber")
  @RequirePermissions("orders.read")
  @ApiOperation({ summary: "Full order detail: items, box picks, payments, refunds, delivery" })
  orderDetail(@Param("orderNumber") orderNumber: string) {
    return this.orders.detail(orderNumber);
  }

  @Patch("orders/:orderNumber/status")
  @RequirePermissions("orders.write")
  @ApiOperation({ summary: "Update an order's status (validated transitions, audited with reason)" })
  updateOrderStatus(
    @CurrentUser("id") actorId: string,
    @Param("orderNumber") orderNumber: string,
    @Body() body: { status: string; reason?: string }
  ) {
    return this.orders.updateStatus(actorId, orderNumber, body.status, body.reason);
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

  // ── Subscriptions ─────────────────────────────────────────────────────
  // Staff actions mirror the member-facing honest semantics: pause keeps the
  // cat's paid benefit, cancel during a prepaid term = "won't renew" (R062-64).
  @Get("subscriptions/:id")
  @RequirePermissions("subscriptions.read")
  @ApiOperation({ summary: "Subscription detail (plan, term, cats, recent events)" })
  subscription(@Param("id") id: string) {
    return this.subscriptions.detail(id);
  }

  @Post("subscriptions/:id/pause")
  @RequirePermissions("subscriptions.write")
  @ApiOperation({ summary: "Pause a membership (deliveries stop; paid benefit stays)" })
  pauseSubscription(
    @CurrentUser("id") actorId: string,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    return this.subscriptions.pause(actorId, id, body?.reason);
  }

  @Post("subscriptions/:id/resume")
  @RequirePermissions("subscriptions.write")
  @ApiOperation({ summary: "Resume a paused membership (paused days are given back)" })
  resumeSubscription(
    @CurrentUser("id") actorId: string,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    return this.subscriptions.resume(actorId, id, body?.reason);
  }

  @Post("subscriptions/:id/cancel")
  @RequirePermissions("subscriptions.write")
  @ApiOperation({ summary: "Cancel a membership (prepaid term keeps servicing until endsAt)" })
  cancelSubscription(
    @CurrentUser("id") actorId: string,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    return this.subscriptions.cancel(actorId, id, body?.reason);
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
