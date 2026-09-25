import { describe, expect, test } from 'bun:test';

import { DatabaseReadinessAdapter } from '../../src/shared/infrastructure/persistence/database-readiness.adapter';

describe('DatabaseReadinessAdapter', () => {
  test('returns an up result after a successful probe', async () => {
    const pool = { query: async () => ({ rows: [{ '?column?': 1 }], rowCount: 1 }) };
    const result = await new DatabaseReadinessAdapter(pool as never).check();

    expect(result.status).toBe('up');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test('propagates driver failures for presentation to map safely', async () => {
    const pool = { query: async () => { throw new Error('private database detail'); } };

    await expect(new DatabaseReadinessAdapter(pool as never).check()).rejects.toThrow(
      'private database detail',
    );
  });
});
