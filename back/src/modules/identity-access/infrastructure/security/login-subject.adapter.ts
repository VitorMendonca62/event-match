import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import { contactBlindIndex, hmacSha256 } from '../../../../shared/infrastructure/security/contact-blind-index';
import type { LoginSubjectPort } from '../../domain/ports/outbound/authentication-security.ports';
import type { LoginEmail } from '../../domain/value-objects/login-email';

/**
 * Keyed digests of the login e-mail under `CONTACT_HASH_KEY` (ADR-014, ADR-035): the registration
 * blind index for the lookup and a separate `auth:login:` domain for the contact bucket.
 */
@Injectable()
export class LoginSubjectAdapter implements LoginSubjectPort {
  private readonly key: Buffer;

  constructor(config: ConfigService<BackendEnv, true>) {
    this.key = Buffer.from(config.getOrThrow<string>('CONTACT_HASH_KEY'), 'base64');
  }

  emailHash(email: LoginEmail): Buffer {
    return contactBlindIndex(this.key, 'email', email.value);
  }

  contactRateSubject(email: LoginEmail): Buffer {
    return hmacSha256(this.key, `auth:login:contact:email:${email.value}`);
  }

  unnormalizedRateSubject(raw: string): Buffer {
    return hmacSha256(this.key, `auth:login:contact:raw:${raw.trim().toLowerCase()}`);
  }
}
