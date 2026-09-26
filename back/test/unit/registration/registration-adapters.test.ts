import { describe, expect, spyOn, test } from 'bun:test';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { LoggerRegistrationTelemetryAdapter } from '../../../src/modules/registration/infrastructure/observability/logger-registration-telemetry.adapter';
import { accountMapper, registrationMapper, verificationMapper } from '../../../src/modules/registration/infrastructure/persistence/mappers/registration.mappers';
import { CommonPasswordCheckerAdapter, parseCommonPasswords } from '../../../src/modules/registration/infrastructure/security/common-password-checker.adapter';
import { ContactProtectorAdapter } from '../../../src/modules/registration/infrastructure/security/contact-protector.adapter';
import { VerificationSecretAdapter } from '../../../src/modules/registration/infrastructure/security/verification-secret.adapter';
import { Account } from '../../../src/modules/registration/domain/entities/account';
import { ContactVerification } from '../../../src/modules/registration/domain/entities/contact-verification';
import { Registration } from '../../../src/modules/registration/domain/entities/registration';
import { BirthDate } from '../../../src/modules/registration/domain/value-objects/birth-date';
import { ContactIdentifier } from '../../../src/modules/registration/domain/value-objects/contact-identifier';
import { Password } from '../../../src/modules/registration/domain/value-objects/password';
import { REGISTRATION_POLICY } from '../../../src/modules/registration/domain/value-objects/verification-policy';

const config = (values: Record<string, string>) =>
  ({ getOrThrow: (key: string) => values[key] }) as unknown as ConfigService<never, true>;
const secrets = {
  CONTACT_HASH_KEY: Buffer.alloc(32, 1).toString('base64'),
  CONTACT_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString('base64'),
  VERIFICATION_SECRET_KEY: Buffer.alloc(32, 3).toString('base64'),
};
const email = ContactIdentifier.create('email', 'ana@example.test');
const now = new Date('2026-09-26T12:00:00.000Z');

describe('ContactProtectorAdapter', () => {
  const protector = new ContactProtectorAdapter(config(secrets));

  test('produces deterministic, domain-separated HMAC indexes', () => {
    expect(protector.blindIndex(email)).toEqual(protector.blindIndex(ContactIdentifier.create('email', 'ANA@example.test')));
    expect(protector.blindIndex(email)).toHaveLength(32);
    expect(protector.rateLimitSubject(email).equals(protector.blindIndex(email))).toBe(false);
    expect(protector.blindIndex(ContactIdentifier.create('whatsapp', '+5581999990000'))).not.toEqual(protector.blindIndex(email));
  });

  test('seals with a unique nonce, opens round-trip and never stores the plain contact', () => {
    const first = protector.seal(email);
    const second = protector.seal(email);

    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
    expect(first.ciphertext.toString('utf8')).not.toContain('ana@example.test');
    expect(protector.open('email', first).value).toBe('ana@example.test');
  });

  test('fails closed when the ciphertext is tampered with or uses an unknown key version', () => {
    const sealed = protector.seal(email);
    const tampered = Buffer.from(sealed.ciphertext);
    tampered[tampered.length - 1] ^= 0xff;

    expect(() => protector.open('email', { ciphertext: tampered, keyVersion: 1 })).toThrow();
    expect(() => protector.open('email', { ...sealed, keyVersion: 2 })).toThrow();
  });

  test('refuses an encryption key that is not exactly 32 bytes', () => {
    expect(
      () => new ContactProtectorAdapter(config({ ...secrets, CONTACT_ENCRYPTION_KEY: Buffer.alloc(48).toString('base64') })),
    ).toThrow('exactly 32 bytes');
  });
});

describe('VerificationSecretAdapter', () => {
  const adapter = new VerificationSecretAdapter(config(secrets));

  test('generates 6-digit OTPs stored only as HMAC digests', () => {
    const otp = adapter.generateOtp();
    expect(otp.plain).toMatch(/^\d{6}$/);
    expect(otp.digest).toHaveLength(32);
    expect(otp.digest.toString('utf8')).not.toContain(otp.plain);
    expect(adapter.matches(otp.plain, otp.digest)).toBe(true);
    expect(adapter.matches(otp.plain === '000000' ? '000001' : '000000', otp.digest)).toBe(false);
  });

  test('generates 32-byte link tokens and rejects digests of other lengths', () => {
    const token = adapter.generateLinkToken();
    expect(Buffer.from(token.plain, 'base64url')).toHaveLength(32);
    expect(adapter.matches(token.plain, token.digest.subarray(0, 16))).toBe(false);
  });
});

describe('CommonPasswordCheckerAdapter', () => {
  test('parses a reduced list case-insensitively', () => {
    expect([...parseCommonPasswords('Password1\r\n\n  QWERTYUIOP  \npassword1\n')]).toEqual(['password1', 'qwertyuiop']);
  });

  test('loads the versioned list and compares ignoring case', () => {
    const checker = new CommonPasswordCheckerAdapter();
    expect(checker.isCommon(Password.create('PASSWORD1'))).toBe(true);
    expect(checker.isCommon(Password.create('uma frase longa e rara 2026'))).toBe(false);
  });
});

describe('registration mappers', () => {
  test('round-trip domain objects without losing state', () => {
    const verification = ContactVerification.issue(
      {
        id: 'v',
        channel: 'whatsapp',
        contactHash: Buffer.alloc(32, 1),
        contactCiphertext: Buffer.alloc(40, 2),
        keyVersion: 1,
        otpDigest: Buffer.alloc(32, 3),
        deliveryIdempotencyKey: 'd',
        whatsappConsentAt: now,
      },
      now,
      REGISTRATION_POLICY,
    ).verify(false, now, REGISTRATION_POLICY);
    const registration = Registration.start(
      {
        id: 'r',
        verificationId: 'v',
        channel: 'email',
        retained: { contactHash: Buffer.alloc(32), contactCiphertext: Buffer.alloc(40), keyVersion: 1, passwordHash: 'h' },
      },
      now,
      REGISTRATION_POLICY,
    );
    const account = Account.createIncomplete({ id: 'a', registrationId: 'r' }, now).activate(
      BirthDate.create('1990-01-01'),
      now,
      REGISTRATION_POLICY,
    );

    const now2 = new Date();
    expect(verificationMapper.toDomain({ ...verificationMapper.toRow(verification), createdAt: now2, updatedAt: now2 })).toEqual(verification);
    expect(registrationMapper.toDomain(registrationMapper.toRow(registration))).toEqual(registration);
    expect(registrationMapper.toDomain(registrationMapper.toRow(registration.convert(now)))).toEqual(registration.convert(now));
    expect(accountMapper.toDomain(accountMapper.toRow(account))).toEqual(account);
  });
});

describe('LoggerRegistrationTelemetryAdapter', () => {
  test('writes one structured JSON line per event', () => {
    const log = spyOn(Logger, 'log').mockImplementation(() => undefined);
    try {
      new LoggerRegistrationTelemetryAdapter().record({
        name: 'verification.requested',
        outcome: 'issued',
        channel: 'email',
        verificationId: 'v',
      });
      expect(log).toHaveBeenCalledWith(
        JSON.stringify({ event: 'registration.verification.requested', outcome: 'issued', channel: 'email', verificationId: 'v' }),
        'Registration',
      );
    } finally {
      log.mockRestore();
    }
  });
});
