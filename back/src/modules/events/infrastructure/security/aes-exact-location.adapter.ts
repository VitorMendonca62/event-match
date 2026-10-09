import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import { EventError } from '../../domain/errors/event.error';
import type { ExactLocationProtectorPort, ProtectedExactLocation } from '../../domain/ports/exact-location-protector.port';
import type { ExactLocation } from '../../domain/value-objects/event-location';

const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 1;

@Injectable()
export class AesExactLocationAdapter implements ExactLocationProtectorPort {
  private readonly key: Buffer | null;

  constructor(config: ConfigService<BackendEnv, true>) {
    const encoded = config.get<string>('EVENT_EXACT_LOCATION_KEY');
    this.key = encoded ? Buffer.from(encoded, 'base64') : null;
  }

  protect(value: ExactLocation): ProtectedExactLocation {
    const key = this.key;
    if (!key || key.length !== 32) throw new EventError('LOCATION_PROTECTION_UNAVAILABLE');
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return { ciphertext, iv, authTag: cipher.getAuthTag(), keyVersion: KEY_VERSION };
  }

  reveal(value: ProtectedExactLocation): ExactLocation {
    const key = this.key;
    if (!key || key.length !== 32 || value.keyVersion !== KEY_VERSION) throw new EventError('LOCATION_PROTECTION_UNAVAILABLE');
    try {
      const decipher = createDecipheriv(ALGORITHM, key, value.iv);
      decipher.setAuthTag(value.authTag);
      const parsed = JSON.parse(Buffer.concat([decipher.update(value.ciphertext), decipher.final()]).toString('utf8')) as Partial<ExactLocation>;
      if (typeof parsed.latitude !== 'number' || typeof parsed.longitude !== 'number') throw new Error('invalid payload');
      return { latitude: parsed.latitude, longitude: parsed.longitude };
    } catch {
      throw new EventError('LOCATION_PROTECTION_UNAVAILABLE');
    }
  }
}
