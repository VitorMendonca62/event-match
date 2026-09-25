import { describe, expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';

import { DatabaseReadinessAdapter } from '../../src/shared/infrastructure/persistence/database-readiness.adapter';
import { attachPostgresPoolErrorHandler } from '../../src/shared/infrastructure/persistence/postgres-pool-error-handler';

describe('attachPostgresPoolErrorHandler', () => {
  test('handles an idle-client error without logging driver details and allows recovery', async () => {
    const pool = Object.assign(new EventEmitter(), {
      query: async () => ({ rows: [{ '?column?': 1 }], rowCount: 1 }),
    });
    const logEntries: string[] = [];

    attachPostgresPoolErrorHandler(pool as never, (entry) => logEntries.push(entry));

    expect(() => pool.emit('error', new Error('postgresql://user:password@host/private detail')))
      .not.toThrow();
    expect(logEntries).toEqual(['{"event":"database.pool.idle_client_error"}']);

    await expect(new DatabaseReadinessAdapter(pool as never).check())
      .resolves.toMatchObject({ status: 'up' });
  });
});
