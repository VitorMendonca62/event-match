import { RegistrationError } from '../errors/registration.error';

export type ContactChannel = 'email' | 'whatsapp';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BRAZILIAN_E164_PATTERN = /^\+55\d{10,11}$/;

/** Normalized contact (ADR-014): lowercase e-mail or Brazilian E.164 number. */
export class ContactIdentifier {
  private constructor(
    readonly channel: ContactChannel,
    readonly value: string,
  ) {}

  static create(channel: ContactChannel, rawValue: string): ContactIdentifier {
    const value = rawValue.trim();

    if (channel === 'email') {
      const normalized = value.toLowerCase();
      if (!EMAIL_PATTERN.test(normalized)) throw new RegistrationError('INVALID_CONTACT');
      return new ContactIdentifier(channel, normalized);
    }

    if (!BRAZILIAN_E164_PATTERN.test(value)) throw new RegistrationError('INVALID_CONTACT');
    return new ContactIdentifier(channel, value);
  }
}
