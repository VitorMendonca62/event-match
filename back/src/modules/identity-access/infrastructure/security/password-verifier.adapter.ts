import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import type { PasswordVerifierPort } from '../../domain/ports/outbound/authentication-security.ports';

/**
 * Argon2id through `Bun.password`, the same primitive and default cost used by registration.
 * The dummy hash is a valid Argon2id of a random secret produced once per process, so the unknown
 * contact path pays one real verification too (ADR-035). A malformed stored hash raises instead
 * of turning into "invalid credentials".
 */
@Injectable()
export class PasswordVerifierAdapter implements PasswordVerifierPort {
  private dummyHash: Promise<string> | undefined;

  verify(candidate: string, hash: string): Promise<boolean> {
    return Bun.password.verify(candidate, hash);
  }

  async verifyDummy(candidate: string): Promise<void> {
    this.dummyHash ??= Bun.password.hash(randomBytes(32).toString('base64url'), { algorithm: 'argon2id' });
    await Bun.password.verify(candidate, await this.dummyHash);
  }
}
