import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { CmsController } from "./cms.controller";
import { AdminAnalyticsService } from "./analytics.service";
import { AdminCustomersService } from "./customers.service";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminProductsService } from "./admin-products.service";
import { CmsService } from "./cms.service";

@Module({
  controllers: [AdminController, CmsController],
  providers: [
    AdminAnalyticsService,
    AdminCustomersService,
    AdminOrdersService,
    AdminProductsService,
    CmsService,
  ],
})
export class AdminModule {}
