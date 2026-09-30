import { createHmac } from 'node:crypto';

/**
 * ADR-014 blind index of a normalized contact: HMAC-SHA-256 under `CONTACT_HASH_KEY` in the
 * `contact:<channel>:` domain. Shared so the registration writer and the identity-access reader
 * compute the same digest without importing each other's infrastructure.
 */
export function contactBlindIndex(key: Buffer, channel: 'email' | 'whatsapp', normalizedValue: string): Buffer {
  return hmacSha256(key, `contact:${channel}:${normalizedValue}`);
}

export function hmacSha256(key: Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}
