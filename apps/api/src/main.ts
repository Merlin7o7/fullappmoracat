// Must be first: initializes Sentry before the app is built (no-op without DSN).
import "./instrument";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { join } from "node:path";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger as PinoLogger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { assertProductionConfig } from "./common/config/env.validation";

/** Build the CORS allow-list: the site URL, its www/apex twin, extras, + dev. */
function buildAllowedOrigins(): string[] {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const origins = new Set<string>([site, "http://localhost:3000"]);
  for (const extra of (process.env.CORS_ORIGINS ?? "").split(",")) {
    const v = extra.trim();
    if (v) origins.add(v);
  }
  try {
    const u = new URL(site);
    const twin = u.host.startsWith("www.")
      ? `${u.protocol}//${u.host.slice(4)}`
      : `${u.protocol}//www.${u.host}`;
    origins.add(twin);
  } catch {
    /* NEXT_PUBLIC_SITE_URL not a URL — ignore */
  }
  return [...origins];
}

async function bootstrap() {
  // Refuse to boot in production with default/weak secrets or a mock PSP behind
  // enabled commerce. Fail closed, loudly, before serving a single request.
  assertProductionConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
    bufferLogs: true,
  });

  // Route all Nest logs through pino (structured JSON + request ids in prod).
  app.useLogger(app.get(PinoLogger));

  // Behind Render/Vercel/Cloudflare the client IP arrives in X-Forwarded-For.
  // Trust the first proxy hop so req.ip is the real client — the per-IP rate
  // limiter and login-history forensics depend on it (else every request looks
  // like it comes from the proxy).
  app.set("trust proxy", 1);

  // ── Security headers ──────────────────────────────────────────────────
  // crossOriginResourcePolicy relaxed so locally-served /uploads images can be
  // embedded by the web app in dev (prod images are served from R2/CDN).
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // Dev-only: serve locally-stored uploads. In production, images live on R2
  // and this directory is empty/unused.
  app.useStaticAssets(join(process.cwd(), ".uploads"), { prefix: "/uploads/" });
  app.enableCors({
    // Allow the site origin plus its www/apex counterpart, plus any extra
    // origins from CORS_ORIGINS (comma-separated). This way both
    // https://moracat.co and https://www.moracat.co work.
    origin: buildAllowedOrigins(),
    credentials: true,
  });

  // ── Global validation (whitelist + transform DTOs) ────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  app.setGlobalPrefix("api", { exclude: ["health"] });

  // ── Swagger / OpenAPI ─────────────────────────────────────────────────
  // Exposed in non-production by default. In production it stays off unless
  // ENABLE_SWAGGER=true is explicitly set, so the API surface isn't advertised.
  const swaggerEnabled =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true";
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle("Moracat API")
      .setDescription("Moracat (موراكات) — cat membership & community platform API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Drain in-flight requests and close Prisma cleanly on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // Honour the platform-provided PORT (Render/Railway/Heroku set it) before our
  // own API_PORT, so the same image runs unchanged on managed hosts.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port);
  app.get(PinoLogger).log(`🚀 Moraqat API on http://localhost:${port}`);
}

void bootstrap();
