import { describe, expect, test } from 'bun:test';

import { getHealth } from '../../src/modules/health/application/use-cases/get-health';

describe('getHealth', () => {
  test('returns the static process availability result', () => {
    expect(getHealth()).toEqual({ status: 'ok' });
  });
});
