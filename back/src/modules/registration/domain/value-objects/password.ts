import { RegistrationError } from '../errors/registration.error';

const MIN_PASSWORD_LENGTH = 8;

/** Structural password rules RN006/RN007; common-password screening lives behind a port. */
export class Password {
  private constructor(readonly value: string) {}

  static create(value: string): Password {
    if (value.length < MIN_PASSWORD_LENGTH || value.trim().length === 0) {
      throw new RegistrationError('INVALID_PASSWORD');
    }
    return new Password(value);
  }
}
