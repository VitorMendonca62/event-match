import { describe, expect, test } from 'bun:test';

describe('Health endpoint (e2e)', () => {
  const baseUrl = process.env.E2E_BASE_URL
;

  if (!process.env.E2E_BASE_URL) {
    throw new Error('E2E_BASE_URL is required for containerized E2E tests.');
  }

  async function get(path: string): Promise<{ status: number; body: unknown }> {
    const response = await fetch(new URL(path, baseUrl));
    return { status: response.status, body: await response.json() };
  }

  test('GET /health returns the standard success envelope from the container', async () => {
    const response = await get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: 'ok' },
      message: 'API disponível',
      statusCode: 200,
    });
  });

  test('missing routes return the standard error envelope', async () => {
    const response = await get('/missing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      data: {},
      message: 'Resource not found.',
      statusCode: 404,
    });
  });

  test('database readiness uses the real PostgreSQL container', async () => {
    const response = await get('/health/readiness');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: 'ok' },
      message: 'Banco de dados disponível',
      statusCode: 200,
    });
  });

  test('the generated OpenAPI document publishes the health route', async () => {
    const response = await get('/docs-json');

    expect(response.status).toBe(200);
    const document = response.body as { paths: Record<string, unknown> };
    expect(document.paths['/health']).toBeDefined();
    expect(document.paths['/health/readiness']).toBeDefined();
  });
});
