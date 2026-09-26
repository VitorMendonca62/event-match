import { describe, expect, test } from 'bun:test';

import {
  postgresErrorCode,
  translateUniqueViolation,
} from '../../src/shared/infrastructure/persistence/postgres-errors';
import {
  InvalidTransactionContextError,
  resolveExecutor,
} from '../../src/shared/infrastructure/persistence/resolve-executor';
import { isUuid } from '../../src/shared/infrastructure/persistence/uuid';

describe('persistence helpers', () => {
  test('reads SQLSTATE directly or through Drizzle wrapping', () => {
    expect(postgresErrorCode({ code: '23505' })).toBe('23505');
    expect(postgresErrorCode(Object.assign(new Error('query failed'), { cause: { code: '40001' } }))).toBe('40001');
    expect(postgresErrorCode(new Error('plain'))).toBeUndefined();
  });

  test('replaces unique violations with a typed error and preserves other failures', async () => {
    const typed = new Error('CONTACT_UNAVAILABLE');
    const wrapped = Object.assign(new Error('insert into "account_contact" ... params: secret'), { cause: { code: '23505' } });

    await expect(translateUniqueViolation(() => Promise.reject(wrapped), () => typed)).rejects.toBe(typed);
    const other = Object.assign(new Error('timeout'), { code: '57014' });
    await expect(translateUniqueViolation(() => Promise.reject(other), () => typed)).rejects.toBe(other);
  });

  test('refuses contexts that did not come from the unit of work', () => {
    expect(() => resolveExecutor({})).toThrow(InvalidTransactionContextError);
  });

  test('guards uuid lookups', () => {
    expect(isUuid('00000000-0000-7000-8000-000000000001')).toBe(true);
    expect(isUuid("1' or '1'='1")).toBe(false);
  });
});
