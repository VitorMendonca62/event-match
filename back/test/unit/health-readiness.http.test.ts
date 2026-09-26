import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/main';
import { DATABASE_READINESS_PORT } from '../../src/shared/application/ports/database-readiness.port';

// In-process HTTP check for the failure path the containerized E2E suite cannot provoke.
describe('GET /health/readiness with PostgreSQL unavailable', () => {
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test('returns a safe 503 envelope', async () => {
    const response = await request(app.getHttpServer()).get('/health/readiness').expect(503);

    expect(response.body).toEqual({
      data: {},
      message: 'Service is temporarily unavailable.',
      statusCode: 503,
    });
  });
});
