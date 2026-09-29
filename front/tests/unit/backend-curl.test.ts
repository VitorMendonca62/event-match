import { describe, expect, test } from 'bun:test';

import { buildBackendCurl } from '../../src/shared/server/backend-client';
import { SECRET, TOKEN, testEnv } from '../integration/bff-fixtures';

describe('buildBackendCurl', () => {
  const request = {
    method: 'POST' as const,
    path: '/registration/contact-verification',
    body: { channel: 'email', contact: 'pessoa@example.test' },
    continuation: TOKEN,
    idempotencyKey: '0123456789abcdef',
    originFingerprint: 'C'.repeat(43),
    internal: true,
  };

  test('matches the NestJS request while masking secrets by default', () => {
    const curl = buildBackendCurl(request, testEnv());
    expect(curl).toContain("--request POST");
    expect(curl).toContain("http://backend.test/api/v1/registration/contact-verification");
    expect(curl).toContain('<BFF_INTERNAL_TOKEN>');
    expect(curl).toContain('<REGISTRATION_CONTINUATION>');
    expect(curl).not.toContain(SECRET);
    expect(curl).not.toContain(TOKEN);
  });

  test('includes real credentials only when explicitly requested', () => {
    const curl = buildBackendCurl(request, testEnv(), { includeSecrets: true });
    expect(curl).toContain(SECRET);
    expect(curl).toContain(TOKEN);
  });
});
