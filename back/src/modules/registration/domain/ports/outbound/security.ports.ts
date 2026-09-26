import type { ContactChannel, ContactIdentifier } from '../../value-objects/contact-identifier';
import type { Password } from '../../value-objects/password';

export const CONTACT_PROTECTOR_PORT = Symbol('CONTACT_PROTECTOR_PORT');
export const VERIFICATION_SECRET_PORT = Symbol('VERIFICATION_SECRET_PORT');
export const PASSWORD_HASHER_PORT = Symbol('PASSWORD_HASHER_PORT');
export const COMMON_PASSWORD_CHECKER_PORT = Symbol('COMMON_PASSWORD_CHECKER_PORT');
export const VERIFICATION_DELIVERY_PORT = Symbol('VERIFICATION_DELIVERY_PORT');

export interface SealedContact {
  readonly ciphertext: Buffer;
  readonly keyVersion: number;
}

/** ADR-014: blind index for lookups, authenticated encryption for delivery. */
export interface ContactProtectorPort {
  blindIndex(contact: ContactIdentifier): Buffer;
  /** Separate HMAC domain (`rate:contact:`) used only by abuse limits (ADR-015). */
  rateLimitSubject(contact: ContactIdentifier): Buffer;
  seal(contact: ContactIdentifier): SealedContact;
  open(channel: ContactChannel, sealed: SealedContact): ContactIdentifier;
}

export interface GeneratedSecret {
  readonly plain: string;
  readonly digest: Buffer;
}

export interface VerificationSecretPort {
  generateOtp(): GeneratedSecret;
  generateLinkToken(): GeneratedSecret;
  matches(plain: string, digest: Buffer): boolean;
}

export interface PasswordHasherPort {
  hash(password: Password): Promise<string>;
  verify(password: Password, hash: string): Promise<boolean>;
}

export interface CommonPasswordCheckerPort {
  isCommon(password: Password): boolean;
}

interface DeliveryTarget {
  readonly channel: ContactChannel;
  readonly sealedContact: SealedContact;
  /** Unique per challenge and send, so provider retries never duplicate a message (ADR-010). */
  readonly idempotencyKey: string;
}

export type VerificationDeliveryRequest =
  | (DeliveryTarget & { readonly kind: 'verify'; readonly verificationId: string; readonly otp: string })
  | (DeliveryTarget & { readonly kind: 'recovery_notice' });

/** Called only after commit; implementations must never log the contact or the code. */
export interface VerificationDeliveryPort {
  send(request: VerificationDeliveryRequest): Promise<{ accepted: boolean }>;
}
