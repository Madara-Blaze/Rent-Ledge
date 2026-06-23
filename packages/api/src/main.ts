import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
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
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('v1');
  app.use(securityHeaders);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiErrorFilter());

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length > 0 ? origins : true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RentLedger API')
    .setDescription(
      'Financial-core slice — double-entry append-only ledger, invoicing (proration + escalation), payments (allocation, advances, TDS withholding), deposit subledger, and TDS preview.',
    )
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`RentLedger API listening on http://localhost:${port}  (Swagger UI: /docs, OpenAPI JSON: /docs-json)`);
}

void bootstrap();
