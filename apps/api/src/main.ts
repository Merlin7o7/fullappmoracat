import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  // ── Security headers ──────────────────────────────────────────────────
  app.use(helmet());
  app.enableCors({
    origin: [process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"],
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

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  Logger.log(`🚀 Moraqat API on http://localhost:${port} — docs at /api/docs`, "Bootstrap");
}

void bootstrap();
