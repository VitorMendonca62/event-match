/** @format */

import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

import type { BackendEnv } from './shared/infrastructure/config/env';
import { HttpExceptionFilter } from './shared/presentation/http/http-exception.filter';

export function configureApplication(app: INestApplication): void {
  // HTTP cross-cutting configuration is centralized at the composition root.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const configService = app.get(ConfigService<BackendEnv, true>);
  if (configService.getOrThrow<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EventMatch API')
      .setDescription('Technical API contract for EventMatch.')
      .setVersion('0.9.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          description: 'Registration continuation token (ADR-021).',
        },
        'registration-continuation',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup(configService.getOrThrow<string>('SWAGGER_PATH'), app, document);
  }
}

export async function createApplication(): Promise<INestApplication> {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableShutdownHooks();
  configureApplication(app);

  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const configService = app.get(ConfigService<BackendEnv, true>);

  const port = configService.getOrThrow<number>('PORT');
  const host = configService.getOrThrow<string>('HOSTNAME');
  await app.listen(port, host);

  const logger = new Logger('Bootstrap');

  logger.debug(`Listing on ${host}:${port} `);
}

if (require.main === module) {
  void bootstrap().catch((error: unknown) => {
    if (
      error instanceof Error &&
      error.message.startsWith('Invalid environment configuration.')
    ) {
      console.error(error.message);
    } else {
      console.log(error);
      console.error('Application failed to start.');
    }

    process.exitCode = 1;
  });
}
