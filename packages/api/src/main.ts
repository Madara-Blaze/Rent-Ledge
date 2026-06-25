import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './common/api-error.filter';
import { securityHeaders } from './common/security/security-headers';

// Safety net: never let a stray BigInt blow up JSON serialisation. Domain DTOs
// already stringify minor units; this guarantees it everywhere.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (this: bigint): string {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  // rawBody: true lets the webhook route verify gateway signatures against the
  // exact bytes received (§9), without a second body parser mutating the payload.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  app.setGlobalPrefix('v1');
  app.disable('x-powered-by'); // SECURITY (§6.4): don't advertise the framework.
  app.use(securityHeaders);

  // SECURITY (§6.4): bound request bodies to blunt memory-exhaustion abuse.
  app.useBodyParser('json', { limit: '512kb' });
  app.useBodyParser('urlencoded', { limit: '512kb', extended: true });

  // SECURITY (§5.1): strip unknown properties AND reject requests that send them,
  // so no handler can be tricked by mass-assignment.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiErrorFilter());

  // SECURITY (§6.2): explicit CORS allowlist, no wildcard. Fail closed in prod if
  // unconfigured; allow the local web app in dev. credentials:true is required for
  // the cookie-based auth migration (§1.1).
  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length > 0 ? origins : isProd ? false : ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-CSRF-Token'],
    maxAge: 600,
  });

  // SECURITY (§1.3): never expose the OpenAPI surface in production.
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('RentLedger API')
      .setDescription(
        'Financial-core slice — double-entry append-only ledger, invoicing (proration + escalation), payments (allocation, advances, TDS withholding), deposit subledger, and TDS preview.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0'); // bind all interfaces for container hosts (Render, etc.)
  // eslint-disable-next-line no-console
  console.log(`RentLedger API listening on http://localhost:${port}${isProd ? '' : '  (Swagger UI: /docs)'}`);
}

void bootstrap();
