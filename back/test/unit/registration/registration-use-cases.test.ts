import { beforeEach, describe, expect, test } from 'bun:test';

import { REGISTRATION_POLICY } from '../../../src/modules/registration/domain/value-objects/verification-policy';
import {
  ADULT_BIRTH_DATE,
  createIncompleteAccount,
  createRegistrationHarness,
  DOCUMENTS,
  INTEREST_IDS,
  seedCatalogAndTerms,
  type RegistrationHarness,
} from '../../support/registration-fakes';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const ALL_DOCUMENTS = Object.values(DOCUMENTS);
const CONTACT = 'ana@example.test';

describe('registration use cases', () => {
  let harness: RegistrationHarness;

  beforeEach(() => {
    harness = createRegistrationHarness();
    seedCatalogAndTerms(harness);
  });

  const requestEmail = (contact = CONTACT) => harness.request.execute({ channel: 'email', contact });
  const verifications = () => [...harness.database.state.verifications.values()];

  describe('RequestContactVerification', () => {
    test('issues a challenge and delivers the OTP after commit', async () => {
      const result = await requestEmail(' Ana@Example.TEST ');

      const [stored] = verifications();
      expect(stored?.id).toBe(result.verificationId);
      expect(stored?.status).toBe('open');
      expect(result.expiresAt).toEqual(new Date(harness.clock.now().getTime() + 15 * MINUTE));
      expect(result.nextResendAt).toEqual(new Date(harness.clock.now().getTime() + MINUTE));
      expect(harness.delivery.sent).toHaveLength(1);
      expect(harness.delivery.sent[0]).toMatchObject({
        kind: 'verify',
        verificationId: result.verificationId,
        idempotencyKey: stored?.deliveryIdempotencyKey,
      });
      expect(stored?.contactHash.toString()).toBe('hash:email:ana@example.test');
    });

    test('requires WhatsApp consent and persists it', async () => {
      await expect(harness.request.execute({ channel: 'whatsapp', contact: '+5581999990000' })).rejects.toMatchObject({
        code: 'WHATSAPP_CONSENT_REQUIRED',
      });

      const consentAt = harness.clock.now();
      await harness.request.execute({ channel: 'whatsapp', contact: '+5581999990000', whatsappConsentAt: consentAt });
      expect(verifications()[0]?.whatsappConsentAt).toEqual(consentAt);
    });

    test('answers identically for a contact held by an account and sends a neutral recovery notice', async () => {
      await createIncompleteAccount(harness);
      const deliveriesBefore = harness.delivery.sent.length;
      const openBefore = verifications().filter((row) => row.status === 'open').length;

      const result = await requestEmail();

      expect(Object.keys(result).sort()).toEqual(['expiresAt', 'nextResendAt', 'verificationId']);
      expect(harness.database.state.verifications.has(result.verificationId)).toBe(false);
      expect(verifications().filter((row) => row.status === 'open')).toHaveLength(openBefore);
      expect(harness.delivery.sent.slice(deliveriesBefore)).toEqual([
        expect.objectContaining({ kind: 'recovery_notice', channel: 'email' }),
      ]);
    });

    test('counts every attempt and throttles after five requests per contact per hour', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await requestEmail();
        harness.clock.advance(MINUTE);
      }
      const deliveries = harness.delivery.sent.length;

      const throttled = await requestEmail();

      expect(harness.delivery.sent).toHaveLength(deliveries);
      expect(harness.database.state.verifications.has(throttled.verificationId)).toBe(false);
      expect(harness.telemetry.events.at(-1)).toMatchObject({ name: 'verification.requested', outcome: 'rate_limited' });
    });

    test('a new request supersedes the unlocked open challenge', async () => {
      const first = await requestEmail();
      const second = await requestEmail();

      expect(harness.database.state.verifications.get(first.verificationId)?.status).toBe('expired');
      expect(harness.database.state.verifications.get(second.verificationId)?.status).toBe('open');
    });

    test('a locked challenge blocks new challenges until the lock ends', async () => {
      const { verificationId } = await requestEmail();
      for (let attempt = 0; attempt < 5; attempt += 1) await harness.verify.execute({ verificationId, otp: '000000' });

      const blocked = await requestEmail();
      expect(harness.database.state.verifications.has(blocked.verificationId)).toBe(false);

      harness.clock.advance(REGISTRATION_POLICY.lockMs);
      const allowed = await requestEmail();
      expect(harness.database.state.verifications.get(allowed.verificationId)?.status).toBe('open');
    });

    test('lazily expires an overdue registration and releases its contact', async () => {
      const { verificationId } = await requestEmail();
      await harness.verify.execute({ verificationId, otp: harness.delivery.lastOtp() });
      const { registrationId } = await harness.start.execute({ verificationId, password: 'uma senha longa' });
      harness.clock.advance(DAY);

      const result = await requestEmail();

      expect(harness.database.state.registrations.get(registrationId)).toMatchObject({ status: 'expired', retained: null });
      expect(harness.database.state.verifications.get(result.verificationId)?.status).toBe('open');
    });

    test('lazily expires a stale incomplete account and erases its personal data', async () => {
      const accountId = await createIncompleteAccount(harness);
      harness.clock.advance(15 * DAY);

      const result = await requestEmail();

      expect(harness.database.state.accounts.get(accountId)).toMatchObject({ status: 'expired', birthDate: null });
      expect(harness.database.state.accountContacts.get(accountId)).toMatchObject({ contactHash: null, holdsContact: false });
      expect(harness.database.state.credentials.get(accountId)).toBeNull();
      expect(harness.database.state.profiles.get(accountId)).toEqual({ displayName: null, region: null });
      expect(harness.database.state.usageIntents.has(accountId)).toBe(false);
      expect(harness.database.state.verifications.get(result.verificationId)?.status).toBe('open');
    });

    test('a delivery failure keeps the neutral response and is recorded without PII', async () => {
      harness.delivery.failing = true;

      const result = await requestEmail();

      expect(harness.database.state.verifications.get(result.verificationId)?.status).toBe('open');
      const failure = harness.telemetry.events.find((event) => event.name === 'verification.delivery_failed');
      expect(failure).toMatchObject({ outcome: 'verify', channel: 'email' });
      expect(JSON.stringify(harness.telemetry.events)).not.toContain('example.test');
    });
  });

  describe('VerifyContact', () => {
    test('verifies with the delivered code', async () => {
      const { verificationId } = await requestEmail();

      await expect(harness.verify.execute({ verificationId, otp: harness.delivery.lastOtp() })).resolves.toEqual({
        verificationId,
        verified: true,
      });
    });

    test('locks after five failures and never counts a sixth attempt', async () => {
      const { verificationId } = await requestEmail();
      const otp = harness.delivery.lastOtp();

      for (let attempt = 0; attempt < 6; attempt += 1) await harness.verify.execute({ verificationId, otp: '000000' });
      const stored = harness.database.state.verifications.get(verificationId);
      expect(stored?.failedAttempts).toBe(5);
      expect(stored?.lockedUntil).toEqual(new Date(harness.clock.now().getTime() + REGISTRATION_POLICY.lockMs));

      await expect(harness.verify.execute({ verificationId, otp })).resolves.toMatchObject({ verified: false });
      harness.clock.advance(REGISTRATION_POLICY.lockMs);
      await expect(harness.verify.execute({ verificationId, otp: '000000' })).resolves.toMatchObject({ verified: false });
      expect(harness.database.state.verifications.get(verificationId)?.failedAttempts).toBe(5);
    });

    test('logs only ids of existing challenges, never caller input', async () => {
      await harness.verify.execute({ verificationId: 'ana@example.test', otp: '123456' });
      await harness.resend.execute({ verificationId: 'ana@example.test' });

      expect(harness.telemetry.events.slice(-2)).toEqual([
        { name: 'verification.attempted', outcome: 'unavailable', verificationId: undefined },
        { name: 'verification.resent', outcome: 'unavailable', verificationId: undefined },
      ]);
    });

    test('answers neutrally for unknown or expired challenges', async () => {
      await expect(harness.verify.execute({ verificationId: 'missing', otp: '123456' })).resolves.toMatchObject({ verified: false });

      const { verificationId } = await requestEmail();
      harness.clock.advance(REGISTRATION_POLICY.otpTtlMs);
      await expect(harness.verify.execute({ verificationId, otp: harness.delivery.lastOtp() })).resolves.toMatchObject({ verified: false });
    });
  });

  describe('ResendContactVerification', () => {
    test('refuses before 60 seconds and rotates the code afterwards', async () => {
      const { verificationId } = await requestEmail();
      const firstOtp = harness.delivery.lastOtp();

      await harness.resend.execute({ verificationId });
      expect(harness.delivery.sent).toHaveLength(1);

      harness.clock.advance(MINUTE);
      await harness.resend.execute({ verificationId });
      const secondOtp = harness.delivery.lastOtp();
      expect(secondOtp).not.toBe(firstOtp);
      expect(harness.delivery.sent.at(-1)).toMatchObject({
        idempotencyKey: `${harness.database.state.verifications.get(verificationId)?.deliveryIdempotencyKey}:resend:1`,
      });

      await expect(harness.verify.execute({ verificationId, otp: firstOtp })).resolves.toMatchObject({ verified: false });
      await expect(harness.verify.execute({ verificationId, otp: secondOtp })).resolves.toMatchObject({ verified: true });
    });

    test('enforces three resends per contact per hour, counting refused attempts', async () => {
      const { verificationId } = await requestEmail();
      for (let attempt = 0; attempt < 4; attempt += 1) {
        harness.clock.advance(MINUTE);
        await harness.resend.execute({ verificationId });
      }

      expect(harness.delivery.sent.filter((request) => request.kind === 'verify')).toHaveLength(4);
      expect(harness.database.state.verifications.get(verificationId)?.resendCount).toBe(3);
    });

    test('answers neutrally for an unknown challenge', async () => {
      const now = harness.clock.now();
      await expect(harness.resend.execute({ verificationId: 'missing' })).resolves.toEqual({
        nextResendAt: new Date(now.getTime() + MINUTE),
      });
      expect(harness.database.state.rateWindows.size).toBe(0);
    });
  });

  describe('StartRegistration', () => {
    test('rejects weak passwords before touching persistence', async () => {
      const { verificationId } = await requestEmail();
      await expect(harness.start.execute({ verificationId, password: 'Password1' })).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
      await expect(harness.start.execute({ verificationId, password: '        ' })).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
    });

    test('requires a verified challenge and consumes it exactly once', async () => {
      const { verificationId } = await requestEmail();
      await expect(harness.start.execute({ verificationId, password: 'uma senha longa' })).rejects.toMatchObject({
        code: 'VERIFICATION_UNAVAILABLE',
      });

      await harness.verify.execute({ verificationId, otp: harness.delivery.lastOtp() });
      const { registrationId, expiresAt } = await harness.start.execute({ verificationId, password: 'uma senha longa' });

      expect(harness.database.state.verifications.get(verificationId)?.status).toBe('consumed');
      expect(harness.database.state.registrations.get(registrationId)?.retained?.passwordHash).toStartWith('argon2id$');
      expect(expiresAt).toEqual(new Date(harness.clock.now().getTime() + DAY));
      await expect(harness.start.execute({ verificationId, password: 'uma senha longa' })).rejects.toMatchObject({
        code: 'VERIFICATION_UNAVAILABLE',
      });
    });
  });

  describe('SaveRequiredData', () => {
    test('creates the incomplete account and converts the registration', async () => {
      const accountId = await createIncompleteAccount(harness);

      const account = harness.database.state.accounts.get(accountId);
      expect(account).toMatchObject({ status: 'account_incomplete' });
      const registration = harness.database.state.registrations.get(account?.registrationId ?? '');
      expect(registration).toMatchObject({ status: 'converted', retained: null, expiredAt: null });
      expect(harness.database.state.profiles.get(accountId)).toEqual({ displayName: 'Ana', region: 'Recife - PE' });
      expect(harness.database.state.usageIntents.get(accountId)).toEqual(['friendship']);
    });

    test('validates input before opening a transaction', async () => {
      const commits = harness.database.commits;
      await expect(
        harness.saveRequiredData.execute({ registrationId: 'r', displayName: ' ', region: 'Recife', usageIntents: ['friendship'] }),
      ).rejects.toMatchObject({ code: 'INVALID_DISPLAY_NAME' });
      await expect(
        harness.saveRequiredData.execute({ registrationId: 'r', displayName: 'Ana', region: 'Recife', usageIntents: [] }),
      ).rejects.toMatchObject({ code: 'INVALID_USAGE_INTENTS' });
      expect(harness.database.commits).toBe(commits);
    });

    test('expires an overdue registration and commits the expiration', async () => {
      const { verificationId } = await requestEmail();
      await harness.verify.execute({ verificationId, otp: harness.delivery.lastOtp() });
      const { registrationId } = await harness.start.execute({ verificationId, password: 'uma senha longa' });
      harness.clock.advance(DAY);

      await expect(
        harness.saveRequiredData.execute({ registrationId, displayName: 'Ana', region: 'Recife', usageIntents: ['friendship'] }),
      ).rejects.toMatchObject({ code: 'REGISTRATION_UNAVAILABLE' });
      expect(harness.database.state.registrations.get(registrationId)).toMatchObject({ status: 'expired', retained: null });
      expect(harness.database.state.accounts.size).toBe(0);
    });
  });

  describe('CompleteRegistration', () => {
    test('activates with three interests and the three approved documents', async () => {
      const accountId = await createIncompleteAccount(harness);

      await expect(
        harness.complete.execute({ accountId, birthDate: ADULT_BIRTH_DATE, interestIds: INTEREST_IDS.slice(0, 3), documentIds: ALL_DOCUMENTS }),
      ).resolves.toEqual({ accountId, status: 'active' });

      expect(harness.database.state.accounts.get(accountId)).toMatchObject({ status: 'active', birthDate: { value: ADULT_BIRTH_DATE } });
      expect(harness.database.state.interests.get(accountId)).toHaveLength(3);
      expect(harness.database.state.acceptances.size).toBe(3);
    });

    test.each([
      ['fewer than three interests', INTEREST_IDS.slice(0, 2), ALL_DOCUMENTS],
      ['duplicated interests', [INTEREST_IDS[0], INTEREST_IDS[0], INTEREST_IDS[0]].map(String), ALL_DOCUMENTS],
      ['a missing document kind', INTEREST_IDS.slice(0, 3), ALL_DOCUMENTS.slice(0, 2)],
    ])('refuses %s without partial effects', async (_label, interestIds, documentIds) => {
      const accountId = await createIncompleteAccount(harness);

      await expect(harness.complete.execute({ accountId, birthDate: ADULT_BIRTH_DATE, interestIds, documentIds })).rejects.toMatchObject({
        code: 'ACCOUNT_CANNOT_BE_ACTIVATED',
      });
      expect(harness.database.state.accounts.get(accountId)?.status).toBe('account_incomplete');
      expect(harness.database.state.interests.has(accountId)).toBe(false);
      expect(harness.database.state.acceptances.size).toBe(0);
    });

    test('refuses placeholder documents (ADR-012)', async () => {
      const accountId = await createIncompleteAccount(harness);
      harness.database.state.termsDocuments.set(DOCUMENTS.privacy, { kind: 'privacy', status: 'placeholder' });

      await expect(
        harness.complete.execute({ accountId, birthDate: ADULT_BIRTH_DATE, interestIds: INTEREST_IDS, documentIds: ALL_DOCUMENTS }),
      ).rejects.toMatchObject({ code: 'ACCOUNT_CANNOT_BE_ACTIVATED' });
    });

    test('refuses minors without persisting their birth date', async () => {
      const accountId = await createIncompleteAccount(harness);

      await expect(
        harness.complete.execute({ accountId, birthDate: '2008-09-27', interestIds: INTEREST_IDS, documentIds: ALL_DOCUMENTS }),
      ).rejects.toMatchObject({ code: 'ACCOUNT_CANNOT_BE_ACTIVATED' });
      expect(harness.database.state.accounts.get(accountId)).toMatchObject({ status: 'account_incomplete', birthDate: null });
    });

    test('validates the birth date before opening a transaction', async () => {
      const accountId = await createIncompleteAccount(harness);
      const commits = harness.database.commits;

      await expect(
        harness.complete.execute({ accountId, birthDate: '2001-02-29', interestIds: INTEREST_IDS, documentIds: ALL_DOCUMENTS }),
      ).rejects.toMatchObject({ code: 'INVALID_BIRTH_DATE' });
      expect(harness.database.commits).toBe(commits);
    });

    test('rolls back everything when a write fails midway', async () => {
      const accountId = await createIncompleteAccount(harness);
      harness.terms.failOnRecord = true;

      await expect(
        harness.complete.execute({ accountId, birthDate: ADULT_BIRTH_DATE, interestIds: INTEREST_IDS, documentIds: ALL_DOCUMENTS }),
      ).rejects.toThrow('simulated persistence failure');
      expect(harness.database.state.accounts.get(accountId)?.status).toBe('account_incomplete');
      expect(harness.database.state.interests.has(accountId)).toBe(false);
    });

    test('activates only once', async () => {
      const accountId = await createIncompleteAccount(harness);
      const input = { accountId, birthDate: ADULT_BIRTH_DATE, interestIds: INTEREST_IDS, documentIds: ALL_DOCUMENTS };

      await harness.complete.execute(input);
      await expect(harness.complete.execute(input)).rejects.toMatchObject({ code: 'ACCOUNT_CANNOT_BE_ACTIVATED' });
      expect(harness.database.state.acceptances.size).toBe(3);
    });

    test('expires a stale incomplete account instead of activating it', async () => {
      const accountId = await createIncompleteAccount(harness);
      harness.clock.advance(15 * DAY);

      await expect(
        harness.complete.execute({ accountId, birthDate: ADULT_BIRTH_DATE, interestIds: INTEREST_IDS, documentIds: ALL_DOCUMENTS }),
      ).rejects.toMatchObject({ code: 'ACCOUNT_CANNOT_BE_ACTIVATED' });
      expect(harness.database.state.accounts.get(accountId)?.status).toBe('expired');
    });
  });

  describe('ExpireStaleRegistrations', () => {
    test('expires overdue registrations and stale incomplete accounts in batch', async () => {
      const accountId = await createIncompleteAccount(harness);
      const { verificationId } = await requestEmail('bia@example.test');
      await harness.verify.execute({ verificationId, otp: harness.delivery.lastOtp() });
      const { registrationId } = await harness.start.execute({ verificationId, password: 'uma senha longa' });
      harness.clock.advance(15 * DAY);

      await expect(harness.expireStale.execute()).resolves.toEqual({ registrations: 1, accounts: 1 });
      expect(harness.database.state.registrations.get(registrationId)?.status).toBe('expired');
      expect(harness.database.state.accounts.get(accountId)?.status).toBe('expired');
      expect(harness.database.state.profiles.get(accountId)).toEqual({ displayName: null, region: null });
      await expect(harness.expireStale.execute()).resolves.toEqual({ registrations: 0, accounts: 0 });
    });
  });
});
