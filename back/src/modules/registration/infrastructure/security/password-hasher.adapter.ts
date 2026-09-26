import { Injectable } from '@nestjs/common';
import type { PasswordHasherPort } from '../../domain/ports/outbound/security.ports';
import type { Password } from '../../domain/value-objects/password';
@Injectable()
export class PasswordHasherAdapter implements PasswordHasherPort {
  hash(password: Password): Promise<string> { return Bun.password.hash(password.value, { algorithm: 'argon2id' }); }
  verify(password: Password, hash: string): Promise<boolean> { return Bun.password.verify(password.value, hash); }
}
