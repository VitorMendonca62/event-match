import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import type { RegistrationFlowTokenPort } from '../../domain/ports/outbound/flow.ports';
import type { GeneratedSecret } from '../../domain/ports/outbound/security.ports';

const TOKEN_BYTES = 32;

/**
 * ADR-021: 32-byte CSPRNG continuation token in base64url; only its HMAC-SHA-256 under the
 * dedicated `REGISTRATION_FLOW_SECRET` is persisted. Purpose prefixes keep the digests of tokens,
 * idempotency keys and payloads in separate domains.
 */
@Injectable()
export class RegistrationFlowTokenAdapter implements RegistrationFlowTokenPort {
  private readonly key: Buffer;

  constructor(config: ConfigService<BackendEnv, true>) {
    this.key = Buffer.from(config.getOrThrow<string>('REGISTRATION_FLOW_SECRET'), 'base64');
  }

  generate(): GeneratedSecret {
    const plain = randomBytes(TOKEN_BYTES).toString('base64url');
    return { plain, digest: this.digest(plain) };
  }

  digest(token: string): Buffer {
    return this.hmac(`token:${token}`);
  }

  fingerprint(purpose: 'idempotency_key' | 'request', value: string): Buffer {
    return this.hmac(`${purpose}:${value}`);
  }

  private hmac(value: string): Buffer {
    return createHmac('sha256', this.key).update(value).digest();
  }
}
