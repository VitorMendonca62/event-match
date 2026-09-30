import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import { hmacSha256 } from '../../../../shared/infrastructure/security/contact-blind-index';
import type { IssuedSessionToken, SessionTokenPort } from '../../domain/ports/outbound/authentication-security.ports';

const TOKEN_BYTES = 32;

/**
 * ADR-033: 256-bit CSPRNG token in base64url; only its HMAC-SHA-256 under `AUTH_SESSION_SECRET`
 * is persisted. The secret is mandatory whenever `AUTH_HTTP_ENABLED` is on (env validation); with
 * the flag off the routes answer 404 before this adapter is ever used.
 */
@Injectable()
export class SessionTokenAdapter implements SessionTokenPort {
  private readonly key: Buffer | null;

  constructor(config: ConfigService<BackendEnv, true>) {
    const secret = config.get<string | undefined>('AUTH_SESSION_SECRET');
    this.key = secret ? Buffer.from(secret, 'base64') : null;
  }

  issue(): IssuedSessionToken {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return { token, digest: this.digest(token) };
  }

  digest(token: string): Buffer {
    if (!this.key) throw new Error('AUTH_SESSION_SECRET is not configured.');
    return hmacSha256(this.key, `session:${token}`);
  }
}
