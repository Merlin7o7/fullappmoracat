import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { CmsController } from "./cms.controller";
import { AdminCommunityController } from "./admin-community.controller";
import { AdminStaffController } from "./staff.controller";
import { FeatureFlagsController } from "./feature-flags.controller";
import { AdminAnalyticsService } from "./analytics.service";
import { AdminAuditService } from "./audit.service";
import { AdminCustomersService } from "./customers.service";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminProductsService } from "./admin-products.service";
import { AdminSubscriptionsService } from "./admin-subscriptions.service";
import { AdminSubscriptionsService } from "./admin-subscriptions.service";
import { AdminCommunityService } from "./admin-community.service";
import { AdminStaffService } from "./staff.service";
import { CmsService } from "./cms.service";

@Module({
  controllers: [AdminController, CmsController, AdminCommunityController, AdminStaffController, FeatureFlagsController],
  providers: [
    AdminAnalyticsService,
    AdminAuditService,
    AdminCustomersService,
    AdminOrdersService,
    AdminProductsService,
    AdminSubscriptionsService,
    AdminSubscriptionsService,
    AdminCommunityService,
    AdminStaffService,
    CmsService,
  ],
})
export class AdminModule {}
