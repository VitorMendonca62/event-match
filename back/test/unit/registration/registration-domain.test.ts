import { describe, expect, test } from 'bun:test';

import { Account } from '../../../src/modules/registration/domain/entities/account';
import { ContactVerification } from '../../../src/modules/registration/domain/entities/contact-verification';
import { Registration } from '../../../src/modules/registration/domain/entities/registration';
import { BirthDate } from '../../../src/modules/registration/domain/value-objects/birth-date';
import { ContactIdentifier } from '../../../src/modules/registration/domain/value-objects/contact-identifier';
import { Password } from '../../../src/modules/registration/domain/value-objects/password';
import { DisplayName, Region, UsageIntent } from '../../../src/modules/registration/domain/value-objects/profile-fields';
import { RegistrationFlowSession } from '../../../src/modules/registration/domain/entities/registration-flow-session';
import { coversRequiredTerms } from '../../../src/modules/registration/domain/value-objects/terms-document-kind';
import { REGISTRATION_POLICY as policy, rateWindowStart } from '../../../src/modules/registration/domain/value-objects/verification-policy';

const now = new Date('2026-09-26T12:00:00.000Z');
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);

const issue = (overrides: Partial<Parameters<typeof ContactVerification.issue>[0]> = {}) =>
  ContactVerification.issue(
    {
      id: 'v',
      channel: 'email',
      contactHash: Buffer.alloc(32, 1),
      contactCiphertext: Buffer.alloc(40, 2),
      keyVersion: 1,
      otpDigest: Buffer.from('first'),
      linkTokenDigest: Buffer.from('link'),
      deliveryIdempotencyKey: 'd',
      whatsappConsentAt: null,
      ...overrides,
    },
    now,
    policy,
  );

const retained = {
  contactHash: Buffer.alloc(32, 1),
  contactCiphertext: Buffer.alloc(40, 2),
  keyVersion: 1,
  passwordHash: 'argon2id$hash',
};

describe('registration value objects', () => {
  test('normalizes e-mail and accepts only Brazilian E.164 WhatsApp numbers', () => {
    expect(ContactIdentifier.create('email', ' Test+tag@Example.TEST ').value).toBe('test+tag@example.test');
    expect(ContactIdentifier.create('whatsapp', '+5511999999999').value).toBe('+5511999999999');
    expect(() => ContactIdentifier.create('whatsapp', '+14155552671')).toThrow('INVALID_CONTACT');
    expect(() => ContactIdentifier.create('email', 'not-an-email')).toThrow('INVALID_CONTACT');
  });

  test('enforces password structure (RN006/RN007)', () => {
    expect(() => Password.create('        ')).toThrow('INVALID_PASSWORD');
    expect(() => Password.create('short')).toThrow('INVALID_PASSWORD');
    expect(Password.create(' spaced password ').value).toBe(' spaced password ');
  });

  test('bounds profile fields and usage intents', () => {
    expect(DisplayName.create('  Ana  ').value).toBe('Ana');
    expect(() => DisplayName.create('   ')).toThrow('INVALID_DISPLAY_NAME');
    expect(() => DisplayName.create('a'.repeat(61))).toThrow('INVALID_DISPLAY_NAME');
    expect(() => Region.create(' x ')).toThrow('INVALID_REGION');
    expect(UsageIntent.createSelection(['friendship', 'friendship', 'networking']).map((intent) => intent.value)).toEqual([
      'friendship',
      'networking',
    ]);
    expect(() => UsageIntent.createSelection(['dating'])).toThrow('INVALID_USAGE_INTENTS');
    expect(() => UsageIntent.createSelection([])).toThrow('INVALID_USAGE_INTENTS');
  });

  test('rejects calendar dates that do not exist', () => {
    expect(() => BirthDate.create('2026-02-31')).toThrow('INVALID_BIRTH_DATE');
    expect(() => BirthDate.create('2001-02-29')).toThrow('INVALID_BIRTH_DATE');
    expect(() => BirthDate.create('2000-13-01')).toThrow('INVALID_BIRTH_DATE');
    expect(BirthDate.create('2000-02-29').value).toBe('2000-02-29');
  });

  test('computes adulthood at the UTC birthday boundary', () => {
    expect(BirthDate.create('2008-09-26').isAdultAt(now)).toBe(true);
    expect(BirthDate.create('2008-09-27').isAdultAt(now)).toBe(false);
  });

  test('requires terms, privacy and community rules, ignoring order and repetition', () => {
    expect(coversRequiredTerms(['community_rules', 'privacy', 'terms', 'terms'])).toBe(true);
    expect(coversRequiredTerms(['terms', 'privacy'])).toBe(false);
  });

  test('aligns rate windows to the UTC hour', () => {
    expect(rateWindowStart(new Date('2026-09-26T12:59:59.999Z'))).toEqual(new Date('2026-09-26T12:00:00.000Z'));
  });
});

describe('ContactVerification', () => {
  test('requires WhatsApp consent', () => {
    expect(() => issue({ channel: 'whatsapp' })).toThrow('WHATSAPP_CONSENT_REQUIRED');
    expect(issue({ channel: 'whatsapp', whatsappConsentAt: now }).whatsappConsentAt).toEqual(now);
  });

  test('expires after 15 minutes', () => {
    const verification = issue();
    expect(verification.expiresAt).toEqual(at(15 * MINUTE));
    expect(() => verification.verify(true, at(15 * MINUTE), policy)).toThrow('VERIFICATION_UNAVAILABLE');
  });

  test('locks for 20 minutes on the fifth failure and refuses further attempts', () => {
    let verification = issue();
    for (let count = 0; count < 5; count += 1) verification = verification.verify(false, now, policy);

    expect(verification.failedAttempts).toBe(5);
    expect(verification.lockedUntil).toEqual(at(20 * MINUTE));
    expect(verification.isLocked(at(20 * MINUTE - 1))).toBe(true);
    expect(() => verification.verify(true, now, policy)).toThrow('VERIFICATION_UNAVAILABLE');
    expect(() => verification.verify(false, at(21 * MINUTE), policy)).toThrow('VERIFICATION_UNAVAILABLE');
  });

  test('resends only after 60 seconds, rotating the digest and renewing the expiry', () => {
    const verification = issue();
    expect(() => verification.resend(Buffer.from('second'), null, at(59_999), policy)).toThrow('VERIFICATION_UNAVAILABLE');

    const resent = verification.resend(Buffer.from('second'), null, at(MINUTE), policy);
    expect(resent.otpDigest.toString()).toBe('second');
    expect(resent.resendCount).toBe(1);
    expect(resent.expiresAt).toEqual(at(16 * MINUTE));
  });

  test('allows at most three resends per challenge', () => {
    let verification = issue();
    for (let count = 1; count <= 3; count += 1) {
      verification = verification.resend(Buffer.from(`otp${count}`), null, at(count * MINUTE), policy);
    }
    expect(() => verification.resend(Buffer.from('otp4'), null, at(4 * MINUTE), policy)).toThrow('VERIFICATION_UNAVAILABLE');
  });

  test('is consumed once, after verification and before expiry', () => {
    const verified = issue().verify(true, now, policy);
    expect(() => issue().consume(now)).toThrow('VERIFICATION_UNAVAILABLE');
    expect(() => verified.consume(at(15 * MINUTE))).toThrow('VERIFICATION_UNAVAILABLE');

    const consumed = verified.consume(at(MINUTE));
    expect(consumed).toMatchObject({ status: 'consumed', consumedAt: at(MINUTE), lastSentAt: now });
    expect(() => consumed.consume(at(MINUTE))).toThrow('VERIFICATION_UNAVAILABLE');
  });
});

describe('Registration', () => {
  const start = () =>
    Registration.start({ id: 'r', verificationId: 'v', channel: 'email', retained }, now, policy);

  test('expires 24 hours after creation', () => {
    const registration = start();
    expect(registration.isExpired(at(24 * 60 * MINUTE - 1))).toBe(false);
    expect(() => registration.retainedDataAt(at(24 * 60 * MINUTE))).toThrow('REGISTRATION_UNAVAILABLE');
  });

  test('distinguishes abandonment from conversion and nulls sensitive data in both', () => {
    expect(start().expire(at(MINUTE))).toMatchObject({ status: 'expired', retained: null, expiredAt: at(MINUTE) });
    expect(start().convert(at(MINUTE))).toMatchObject({ status: 'converted', retained: null, expiredAt: null });
    expect(() => start().convert(now).expire(now)).toThrow('REGISTRATION_UNAVAILABLE');
  });

  test('rejects inconsistent persisted state', () => {
    expect(() => Registration.restore({ ...start(), retained: null })).toThrow();
  });
});

describe('Account', () => {
  const adult = BirthDate.create('1990-01-01');
  const incomplete = () => Account.createIncomplete({ id: 'a', registrationId: 'r' }, now);

  test('starts without a birth date (RF004 data only)', () => {
    expect(incomplete().birthDate).toBeNull();
  });

  test('receives the birth date at activation, refusing minors', () => {
    expect(incomplete().activate(adult, at(MINUTE), policy)).toMatchObject({
      status: 'active',
      birthDate: adult,
      activatedAt: at(MINUTE),
    });
    expect(() => incomplete().activate(BirthDate.create('2010-01-01'), now, policy)).toThrow('ACCOUNT_CANNOT_BE_ACTIVATED');
    expect(() => incomplete().activate(adult, now, policy).activate(adult, now, policy)).toThrow('ACCOUNT_CANNOT_BE_ACTIVATED');
  });

  test('becomes stale after 15 days and then cannot be activated', () => {
    const fifteenDays = 15 * 24 * 60 * MINUTE;
    expect(incomplete().isStale(at(fifteenDays - 1), policy)).toBe(false);
    expect(incomplete().isStale(at(fifteenDays), policy)).toBe(true);
    expect(() => incomplete().activate(adult, at(fifteenDays), policy)).toThrow('ACCOUNT_CANNOT_BE_ACTIVATED');
  });

  test('expires without personal data', () => {
    expect(incomplete().expire(at(MINUTE))).toMatchObject({ status: 'expired', birthDate: null, expiredAt: at(MINUTE) });
  });
});

describe('ContactVerification e-mail link (ADR-024)', () => {
  test('verifies once by link and burns it', () => {
    const verified = issue().verifyByLink(at(MINUTE), policy);
    expect(verified.status).toBe('verified');
    expect(verified.linkTokenDigest).toBeNull();
    expect(() => verified.verifyByLink(at(MINUTE), policy)).toThrow('VERIFICATION_UNAVAILABLE');
  });

  test('refuses expired or locked challenges and challenges without a link', () => {
    expect(() => issue().verifyByLink(at(15 * MINUTE), policy)).toThrow('VERIFICATION_UNAVAILABLE');
    let locked = issue();
    for (let attempt = 0; attempt < policy.maxAttempts; attempt += 1) locked = locked.verify(false, now, policy);
    expect(() => locked.verifyByLink(now, policy)).toThrow('VERIFICATION_UNAVAILABLE');
    expect(() => issue({ linkTokenDigest: null }).verifyByLink(now, policy)).toThrow('VERIFICATION_UNAVAILABLE');
  });

  test('an OTP success also burns the link', () => {
    expect(issue().verify(true, now, policy).linkTokenDigest).toBeNull();
  });
});

describe('RegistrationFlowSession (ADR-021)', () => {
  const eligible = () => RegistrationFlowSession.issueEligible({ id: 's', tokenDigest: Buffer.from('t1') }, now, policy);

  test('starts age_eligible for 30 minutes without any binding', () => {
    const session = eligible();
    expect(session).toMatchObject({ stage: 'age_eligible', verificationId: null, expiresAt: at(30 * MINUTE) });
    expect(session.match(Buffer.from('t1'), at(30 * MINUTE))).toBeNull();
  });

  test('walks the stages in order and refuses skips', () => {
    const session = eligible();
    expect(() => session.startRegistration('r', at(DAY), now)).toThrow('FLOW_STAGE_CONFLICT');
    const pending = session.awaitVerification('v', at(15 * MINUTE), now);
    const verified = pending.confirmContact(at(15 * MINUTE), now);
    const started = verified.startRegistration('r', at(DAY), now);
    const incomplete = started.createAccount('a', at(15 * DAY), now);
    expect(incomplete).toMatchObject({ stage: 'account_incomplete', verificationId: 'v', registrationId: 'r', accountId: 'a' });
    expect(() => incomplete.awaitVerification('v2', at(15 * MINUTE), now)).toThrow('FLOW_STAGE_CONFLICT');
  });

  test('a neutral pending session can never confirm', () => {
    const pending = eligible().awaitVerification(null, at(15 * MINUTE), now);
    expect(() => pending.confirmContact(at(15 * MINUTE), now)).toThrow('FLOW_STAGE_CONFLICT');
  });

  test('rotation keeps the previous token for 60 seconds only', () => {
    const rotated = eligible().rotate(Buffer.from('t2'), now, policy);
    expect(rotated.match(Buffer.from('t2'), now)).toBe('current');
    expect(rotated.match(Buffer.from('t1'), at(59_999))).toBe('previous');
    expect(rotated.match(Buffer.from('t1'), at(MINUTE))).toBeNull();
  });

  test('completion revokes and nulls every digest', () => {
    const incomplete = eligible()
      .awaitVerification('v', at(15 * MINUTE), now)
      .confirmContact(at(15 * MINUTE), now)
      .startRegistration('r', at(DAY), now)
      .createAccount('a', at(15 * DAY), now)
      .rotate(Buffer.from('t2'), now, policy);
    const completed = incomplete.complete(now);
    expect(completed).toMatchObject({ stage: 'completed', tokenDigest: null, previousTokenDigest: null, revokedAt: now });
    expect(completed.match(Buffer.from('t2'), now)).toBeNull();
  });
});
