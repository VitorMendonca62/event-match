import { describe, expect, test } from 'bun:test';

import { DrizzleUnitOfWork } from '../../src/shared/infrastructure/persistence/drizzle-unit-of-work';

describe('DrizzleUnitOfWork', () => {
  test('delegates the callback to the transaction boundary', async () => {
    const statements: unknown[] = [];
    const transaction = { execute: async (statement: unknown) => statements.push(statement) };
    const database = {
      transaction: async <T>(work: (context: object) => Promise<T>) => work(transaction),
    };
    const unitOfWork = new DrizzleUnitOfWork(database as never);

    await expect(unitOfWork.execute(async (context) => context)).resolves.toBe(transaction);
    expect(statements).toHaveLength(1);
  });

  test('propagates callback failures for the application boundary', async () => {
    let rolledBack = false;
    const database = {
      transaction: async <T>(work: (context: object) => Promise<T>) => {
        try {
          return await work({ execute: async () => undefined });
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
    };
    const unitOfWork = new DrizzleUnitOfWork(database as never);

    await expect(unitOfWork.execute(async () => { throw new Error('domain failure'); })).rejects.toThrow(
      'domain failure',
    );
    expect(rolledBack).toBe(true);
  });
});
