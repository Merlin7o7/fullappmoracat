import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { LoggerModule } from "nestjs-pino";
import type { IncomingMessage } from "node:http";
import { SentryExceptionFilter } from "./common/sentry-exception.filter";
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
import { EmailVerifiedGuard } from "./common/guards/email-verified.guard";
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
    // Structured JSON logging + a per-request correlation id (propagated from an
    // upstream x-request-id or minted). Pretty-printed in dev, JSON in prod so
    // logs are queryable/shippable. Health checks are silenced to cut noise.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
        genReqId: (req: IncomingMessage) =>
          (req.headers["x-request-id"] as string) || randomUUID(),
        autoLogging: { ignore: (req: IncomingMessage) => req.url === "/health" },
        transport:
          process.env.NODE_ENV === "production"
            ? undefined
            : { target: "pino-pretty", options: { singleLine: true, translateTime: "SYS:HH:MM:ss" } },
        // Never log Authorization headers or cookies.
        redact: ["req.headers.authorization", "req.headers.cookie"],
      },
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
    // Runs after auth: gates @RequireEmailVerified UGC-write routes.
    { provide: APP_GUARD, useClass: EmailVerifiedGuard },
    // Report 5xx/unhandled faults to Sentry (no-op without SENTRY_DSN).
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
  ],
})
export class AppModule {}
