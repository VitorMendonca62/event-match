import { describe, expect, test } from 'bun:test';
import { Account } from '../../src/modules/registration/domain/entities/account';
import { ContactVerification } from '../../src/modules/registration/domain/entities/contact-verification';
import { BirthDate } from '../../src/modules/registration/domain/value-objects/birth-date';
import { ContactIdentifier } from '../../src/modules/registration/domain/value-objects/contact-identifier';
import { Password } from '../../src/modules/registration/domain/value-objects/password';
import { DisplayName, Region, UsageIntent } from '../../src/modules/registration/domain/value-objects/profile-fields';
import { VerificationPolicy } from '../../src/modules/registration/domain/value-objects/verification-policy';

describe('registration domain', () => {
  test('normalizes email and accepts only Brazilian E.164 WhatsApp numbers', () => {
    expect(ContactIdentifier.create('email', ' Test+tag@Example.TEST ').value).toBe('test+tag@example.test');
    expect(ContactIdentifier.create('whatsapp', '+5511999999999').value).toBe('+5511999999999');
    expect(() => ContactIdentifier.create('whatsapp', '+14155552671')).toThrow();
  });
  test('enforces password, profile and usage intent boundaries', () => {
    expect(() => Password.create('       ')).toThrow(); expect(() => Password.create('short')).toThrow();
    expect(DisplayName.create('  Ana  ').value).toBe('Ana'); expect(() => Region.create(' x ')).toThrow();
    expect(UsageIntent.create('friendship').value).toBe('friendship'); expect(() => UsageIntent.create('dating')).toThrow();
  });
  test('computes adulthood at the UTC birthday boundary', () => {
    expect(BirthDate.create('2008-09-26').isAdultAt(new Date('2026-09-26T12:00:00Z'))).toBe(true);
    expect(BirthDate.create('2008-09-27').isAdultAt(new Date('2026-09-26T12:00:00Z'))).toBe(false);
  });
  test('caps wrong OTP failures at five and locks the challenge', () => {
    const now = new Date('2026-09-26T00:00:00Z'); const policy = new VerificationPolicy();
    let verification = new ContactVerification('v', 'email', Buffer.alloc(32), Buffer.alloc(40), 1, Buffer.alloc(32), new Date(now.getTime() + 900_000), 'd', now);
    for (let count = 0; count < 5; count += 1) verification = verification.verify(false, now, policy);
    expect(verification.failedAttempts).toBe(5); expect(verification.lockedUntil).toEqual(new Date(now.getTime() + 1_200_000));
    expect(() => verification.verify(false, now, policy)).toThrow('VERIFICATION_UNAVAILABLE');
  });
  test('does not activate a minor account', () => {
    const account = new Account('a', 'r', 'account_incomplete', BirthDate.create('2010-01-01'), new Date());
    expect(() => account.activate(new Date('2026-09-26T00:00:00Z'))).toThrow('ACCOUNT_CANNOT_BE_ACTIVATED');
  });
});
