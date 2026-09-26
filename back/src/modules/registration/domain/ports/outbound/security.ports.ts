import type { ContactIdentifier } from '../../value-objects/contact-identifier';
import type { Password } from '../../value-objects/password';

export const CONTACT_PROTECTOR_PORT = Symbol('CONTACT_PROTECTOR_PORT');
export const VERIFICATION_SECRET_PORT = Symbol('VERIFICATION_SECRET_PORT');
export const PASSWORD_HASHER_PORT = Symbol('PASSWORD_HASHER_PORT');
export const COMMON_PASSWORD_CHECKER_PORT = Symbol('COMMON_PASSWORD_CHECKER_PORT');
export const VERIFICATION_DELIVERY_PORT = Symbol('VERIFICATION_DELIVERY_PORT');

export interface SealedContact { readonly ciphertext: Buffer; readonly keyVersion: number; }
export interface ContactProtectorPort {
  blindIndex(contact: ContactIdentifier): Buffer;
  seal(contact: ContactIdentifier): SealedContact;
  open(channel: ContactIdentifier['channel'], sealed: SealedContact): ContactIdentifier;
}
export interface VerificationSecretPort {
  generateOtp(): { plain: string; digest: Buffer };
  generateLinkToken(): { plain: string; digest: Buffer };
  matches(plain: string, digest: Buffer): boolean;
}
export interface PasswordHasherPort { hash(password: Password): Promise<string>; verify(password: Password, hash: string): Promise<boolean>; }
export interface CommonPasswordCheckerPort { isCommon(password: Password): boolean; }
export interface VerificationDeliveryPort {
  send(input: { verificationId: string; channel: ContactIdentifier['channel']; sealedContact: SealedContact; kind: 'verify' | 'recovery_notice'; idempotencyKey: string }): Promise<{ accepted: boolean }>;
}
