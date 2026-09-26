import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import type { VerificationSecretPort } from '../../domain/ports/outbound/security.ports';

@Injectable()
export class VerificationSecretAdapter implements VerificationSecretPort {
  private readonly key: Buffer;
  constructor(config: ConfigService<BackendEnv, true>) { this.key = Buffer.from(config.getOrThrow<string>('VERIFICATION_SECRET_KEY'), 'base64'); }
  private digest(value: string): Buffer { return createHmac('sha256', this.key).update(value).digest(); }
  generateOtp() { const plain = String(randomInt(100_000, 1_000_000)); return { plain, digest: this.digest(plain) }; }
  generateLinkToken() { const plain = randomBytes(32).toString('base64url'); return { plain, digest: this.digest(plain) }; }
  matches(plain: string, digest: Buffer): boolean { const actual = this.digest(plain); return actual.length === digest.length && timingSafeEqual(actual, digest); }
}
