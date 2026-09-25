import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/main';
import { DATABASE_READINESS_PORT } from '../../src/shared/application/ports/database-readiness.port';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE_READINESS_PORT)
      .useValue({
        check: async () => {
          throw new Error('controlled database unavailability');
        },
      })
      .compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  test('GET /health returns the standard success envelope', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({
      data: { status: 'ok' },
      message: 'API disponível',
      statusCode: 200,
    });
  });

  test('missing routes return the standard error envelope', async () => {
    const response = await request(app.getHttpServer()).get('/missing').expect(404);

    expect(response.body).toEqual({
      data: {},
      message: 'Resource not found.',
      statusCode: 404,
    });
  });

  test('database readiness returns a safe 503 when PostgreSQL is unavailable', async () => {
    const response = await request(app.getHttpServer()).get('/health/readiness').expect(503);

    expect(response.body).toEqual({
      data: {},
      message: 'Service is temporarily unavailable.',
      statusCode: 503,
    });
  });

  test('the generated OpenAPI document publishes the health route', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(response.body.paths['/health']).toBeDefined();
    expect(response.body.paths['/health/readiness']).toBeDefined();
  });
});
