import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import type {
  GeneratedSecret,
  VerificationSecretPort,
} from '../../domain/ports/outbound/security.ports';

/** ADR-014: 6-digit OTP and 32-byte link token from a CSPRNG, stored only as HMAC-SHA-256. */
@Injectable()
export class VerificationSecretAdapter implements VerificationSecretPort {
  private readonly key: Buffer;

  constructor(config: ConfigService<BackendEnv, true>) {
    this.key = Buffer.from(config.getOrThrow<string>('VERIFICATION_SECRET_KEY'), 'base64');
  }

  generateOtp(): GeneratedSecret {
    const plain = String(randomInt(0, 1_000_000)).padStart(6, '0');
    return { plain, digest: this.digest(plain) };
  }

  generateLinkToken(): GeneratedSecret {
    const plain = randomBytes(32).toString('base64url');
    return { plain, digest: this.digest(plain) };
  }

  matches(plain: string, digest: Buffer): boolean {
    const actual = this.digest(plain);
    return actual.length === digest.length && timingSafeEqual(actual, digest);
  }

  private digest(value: string): Buffer {
    return createHmac('sha256', this.key).update(value).digest();
  }
}
