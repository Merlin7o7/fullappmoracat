import { Module } from "@nestjs/common";
import { CatsModule } from "../cats/cats.module";
import { LifecycleModule } from "../lifecycle/lifecycle.module";
import { AdminController } from "./admin.controller";
import { AdminCatsService } from "./admin-cats.service";
import { CmsController } from "./cms.controller";
import { AdminCommunityController } from "./admin-community.controller";
import { AdminStaffController } from "./staff.controller";
import { FeatureFlagsController } from "./feature-flags.controller";
import { AdminAnalyticsService } from "./analytics.service";
import { AdminMetricsService } from "./metrics.service";
import { AdminAuditService } from "./audit.service";
import { AdminCustomersService } from "./customers.service";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminProductsService } from "./admin-products.service";
import { AdminSubscriptionsService } from "./admin-subscriptions.service";
import { AdminCommunityService } from "./admin-community.service";
import { AdminStaffService } from "./staff.service";
import { CmsService } from "./cms.service";

@Module({
  imports: [CatsModule, LifecycleModule],
  controllers: [AdminController, CmsController, AdminCommunityController, AdminStaffController, FeatureFlagsController],
  providers: [
    AdminAnalyticsService,
    AdminMetricsService,
    AdminCatsService,
    AdminAuditService,
    AdminCustomersService,
    AdminOrdersService,
    AdminProductsService,
    AdminSubscriptionsService,
    AdminCommunityService,
    AdminStaffService,
    CmsService,
  ],
})
export class AdminModule {}
