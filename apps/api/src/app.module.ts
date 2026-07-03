import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { PlansModule } from "./plans/plans.module";
import { AuthModule } from "./auth/auth.module";
import { CatsModule } from "./cats/cats.module";
import { FeedingModule } from "./feeding/feeding.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProductsModule } from "./products/products.module";
import { CartModule } from "./cart/cart.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { AccountModule } from "./account/account.module";
import { OrdersModule } from "./orders/orders.module";
import { AddressesModule } from "./addresses/addresses.module";
import { GeoModule } from "./geo/geo.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { AdminModule } from "./admin/admin.module";
import { ContentModule } from "./content/content.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SupportModule } from "./support/support.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting — 120 requests / minute per IP by default.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    HealthModule,
    PlansModule,
    AuthModule,
    CatsModule,
    FeedingModule,
    PaymentsModule,
    ProductsModule,
    CartModule,
    CheckoutModule,
    SubscriptionsModule,
    AccountModule,
    OrdersModule,
    AddressesModule,
    GeoModule,
    AdminModule,
    ContentModule,
    NotificationsModule,
    SupportModule,
  ],
  providers: [
    // Order matters: rate-limit → authenticate → authorize (permissions).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
