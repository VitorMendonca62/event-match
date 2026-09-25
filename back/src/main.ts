import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
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
      .setVersion('0.6.0')
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

  await app.listen(
    configService.getOrThrow<number>('PORT'),
    configService.getOrThrow<string>('HOSTNAME'),
  );
}

if (require.main === module) {
  void bootstrap().catch((error: unknown) => {
    if (error instanceof Error && error.message.startsWith('Invalid environment configuration.')) {
      console.error(error.message);
    } else {
      console.error('Application failed to start.');
    }

    process.exitCode = 1;
  });
}
