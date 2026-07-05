import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { CmsController } from "./cms.controller";
import { AdminCommunityController } from "./admin-community.controller";
import { AdminAnalyticsService } from "./analytics.service";
import { AdminCustomersService } from "./customers.service";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminProductsService } from "./admin-products.service";
import { AdminCommunityService } from "./admin-community.service";
import { CmsService } from "./cms.service";

@Module({
  controllers: [AdminController, CmsController, AdminCommunityController],
  providers: [
    AdminAnalyticsService,
    AdminCustomersService,
    AdminOrdersService,
    AdminProductsService,
    AdminCommunityService,
    CmsService,
  ],
})
export class AdminModule {}
