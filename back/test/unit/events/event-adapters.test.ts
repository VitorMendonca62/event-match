import { describe, expect, test } from 'bun:test';
import { ConfigService } from '@nestjs/config';

import { EventError } from '../../../src/modules/events/domain/errors/event.error';
import { AesExactLocationAdapter } from '../../../src/modules/events/infrastructure/security/aes-exact-location.adapter';
import { DeterministicAreaProjectorAdapter } from '../../../src/modules/events/infrastructure/security/deterministic-area-projector.adapter';
import type { BackendEnv } from '../../../src/shared/infrastructure/config/env';

const location = { latitude: -8.0476, longitude: -34.877 };

function config(values: Record<string, unknown>): ConfigService<BackendEnv, true> {
  return new ConfigService<BackendEnv, true>(values as Partial<BackendEnv>);
}

describe('event security adapters (ADR-055)', () => {
  test('encrypts exact coordinates with AES-GCM and rejects tampering', () => {
    const adapter = new AesExactLocationAdapter(config({ EVENT_EXACT_LOCATION_KEY: Buffer.alloc(32, 7).toString('base64') }));
    const protectedValue = adapter.protect(location);
    expect(protectedValue.ciphertext.toString('utf8')).not.toContain('-8.0476');
    expect(adapter.reveal(protectedValue)).toEqual(location);
    expect(() => adapter.reveal({ ...protectedValue, authTag: Buffer.alloc(16) })).toThrow(EventError);
  });

  test('fails closed without the exact-location key and projects a stable displaced area', () => {
    const adapter = new AesExactLocationAdapter(config({ EVENT_EXACT_LOCATION_KEY: 'invalid' }));
    expect(() => adapter.protect(location)).toThrow(EventError);

    const projector = new DeterministicAreaProjectorAdapter(config({ EVENT_APPROXIMATE_RADIUS_METERS: 500 }));
    const first = projector.project('event-1', location);
    expect(projector.project('event-1', location)).toEqual(first);
    expect(first).not.toMatchObject(location);
    expect(first.radiusMeters).toBe(500);
  });
});
