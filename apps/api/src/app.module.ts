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
import { CommerceGuard } from "./common/guards/commerce.guard";
import { AdminModule } from "./admin/admin.module";
import { ContentModule } from "./content/content.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SupportModule } from "./support/support.module";
import { IdsModule } from "./ids/ids.module";
import { VerifyModule } from "./verify/verify.module";
import { WaitlistModule } from "./waitlist/waitlist.module";
import { MailModule } from "./mail/mail.module";
import { StorageModule } from "./storage/storage.module";
import { CommunityModule } from "./community/community.module";
import { UploadsModule } from "./uploads/uploads.module";
import { WalletModule } from "./wallet/wallet.module";

@Module({
  imports: [
    // Load env from the monorepo root (…/.env.local, …/.env) as well as the
    // app cwd, so `nest start` from apps/api still picks up shared secrets.
    // Missing files are ignored; platform-injected vars (Render/Vercel) always
    // win over file values.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env.local", "../../.env", ".env.local", ".env"],
    }),
    MailModule,
    StorageModule,
    CommunityModule,
    UploadsModule,
    WalletModule,
    // Rate limiting — 120 requests / minute per IP by default.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    IdsModule,
    HealthModule,
    PlansModule,
    AuthModule,
    CatsModule,
    VerifyModule,
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
    WaitlistModule,
  ],
  providers: [
    // Order matters: rate-limit → Community-Mode kill-switch → authenticate →
    // authorize (permissions). The commerce gate runs before auth so a disabled
    // monetization surface returns a clean "coming soon" 403 to anyone.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CommerceGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
