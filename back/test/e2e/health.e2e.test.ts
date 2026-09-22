import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApplication } from '../../src/main';

describe('Health endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApplication();
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

  test('the generated OpenAPI document publishes the health route', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(response.body.paths['/health']).toBeDefined();
  });
});
