export type ContactChannel = 'email' | 'whatsapp';

export class ContactIdentifier {
  private constructor(readonly channel: ContactChannel, readonly value: string) {}

  static create(channel: ContactChannel, rawValue: string): ContactIdentifier {
    const value = rawValue.trim();
    if (channel === 'email') {
      const normalized = value.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Invalid contact identifier.');
      return new ContactIdentifier(channel, normalized);
    }
    if (!/^\+55\d{10,11}$/.test(value)) throw new Error('Invalid contact identifier.');
    return new ContactIdentifier(channel, value);
  }
}
