import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

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
  const app = await NestFactory.create(AppModule, { cors: false });

  // ── Security headers ──────────────────────────────────────────────────
  app.use(helmet());
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
  const config = new DocumentBuilder()
    .setTitle("Moraqat API")
    .setDescription("Moraqat (مرقط) — cat essentials subscription platform API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Honour the platform-provided PORT (Render/Railway/Heroku set it) before our
  // own API_PORT, so the same image runs unchanged on managed hosts.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port);
  Logger.log(`🚀 Moraqat API on http://localhost:${port} — docs at /api/docs`, "Bootstrap");
}

void bootstrap();
