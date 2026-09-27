import { beforeEach, describe, expect, test } from 'bun:test';

import type { FlowCredentials } from '../../../src/modules/registration/application/services/registration-flow-gate';
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
const CONTACT = 'ana@example.test';
const ORIGIN = Buffer.alloc(32, 9);
const PASSWORD = 'uma senha longa';
const REQUIRED = { displayName: 'Ana', region: 'Recife - PE', usageIntents: ['friendship'] };
const COMPLETION = {
  birthDate: ADULT_BIRTH_DATE,
  documentIds: Object.values(DOCUMENTS),
  interestIds: INTEREST_IDS.slice(0, 3),
};

describe('registration HTTP flow (application)', () => {
  let harness: RegistrationHarness;
  let keys = 0;

  beforeEach(() => {
    harness = createRegistrationHarness();
    seedCatalogAndTerms(harness);
    keys = 0;
  });

  const key = () => `idempotency-key-${String((keys += 1)).padStart(4, '0')}`;
  const as = (token: string, idempotencyKey = key()): FlowCredentials => ({ token, idempotencyKey });
  const sessions = () => [...harness.database.state.sessions.values()];

  async function eligible(): Promise<string> {
    const eligibility = await harness.eligibility.execute({ birthDate: ADULT_BIRTH_DATE });
    if (!eligibility.eligible) throw new Error('expected eligibility');
    return eligibility.continuation;
  }

  async function verified(contact = CONTACT): Promise<string> {
    const token = await eligible();
    await harness.flow.requestContactVerification(as(token), { contact, originFingerprint: ORIGIN });
    const confirmed = await harness.flow.confirmContact(as(token), { otp: harness.delivery.lastOtp() });
    if (!confirmed.continuation) throw new Error('expected rotation');
    return confirmed.continuation;
  }

  async function incomplete(): Promise<string> {
    const afterPassword = await harness.flow.choosePassword(as(await verified()), { password: PASSWORD });
    const afterRequired = await harness.flow.saveRequiredData(as(afterPassword.continuation!), REQUIRED);
    return afterRequired.continuation!;
  }

  describe('eligibility (ADR-019)', () => {
    test('a minor gets no continuation and nothing is written', async () => {
      const today = harness.clock.now();
      const almost18 = `${today.getUTCFullYear() - 18}-09-27`;

      await expect(harness.eligibility.execute({ birthDate: almost18 })).resolves.toEqual({ eligible: false });
      expect(sessions()).toHaveLength(0);
      expect(harness.telemetry.events).toEqual([{ name: 'registration.eligibility', outcome: 'ineligible' }]);
    });

    test('the 18th birthday is eligible and issues an age_eligible session for 30 minutes', async () => {
      const today = `${harness.clock.now().getUTCFullYear() - 18}-09-26`;
      const result = await harness.eligibility.execute({ birthDate: today });

      expect(result).toMatchObject({ eligible: true, expiresAt: new Date(harness.clock.now().getTime() + 30 * MINUTE) });
      expect(sessions()).toEqual([expect.objectContaining({ stage: 'age_eligible', verificationId: null })]);
    });

    test('the birth date never reaches the session or telemetry', async () => {
      await harness.eligibility.execute({ birthDate: ADULT_BIRTH_DATE });
      expect(JSON.stringify(sessions())).not.toContain(ADULT_BIRTH_DATE);
      expect(JSON.stringify(harness.telemetry.events)).not.toContain(ADULT_BIRTH_DATE);
    });

    test('rejects dates that do not exist', async () => {
      await expect(harness.eligibility.execute({ birthDate: '2001-02-30' })).rejects.toMatchObject({
        code: 'INVALID_BIRTH_DATE',
      });
    });
  });

  describe('journey', () => {
    test('runs eligibility → contact → OTP → password → required data → activation', async () => {
      const token = await incomplete();
      const result = await harness.flow.complete(as(token), COMPLETION);

      expect(result).toEqual({ body: { status: 'active' }, continuation: null });
      const [session] = sessions();
      expect(session).toMatchObject({ stage: 'completed', tokenDigest: null, previousTokenDigest: null });
      expect(session?.revokedAt).not.toBeNull();
      expect([...harness.database.state.accounts.values()][0]?.status).toBe('active');
      // A completed session no longer authorizes anything.
      await expect(harness.flow.snapshot(token)).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });
    });

    test('every privilege change rotates the token and binds ids from the session only', async () => {
      const token = await eligible();
      await harness.flow.requestContactVerification(as(token), { contact: CONTACT, originFingerprint: ORIGIN });
      const confirmed = await harness.flow.confirmContact(as(token), { otp: harness.delivery.lastOtp() });

      expect(confirmed.body).toEqual({ verified: true });
      expect(confirmed.continuation).not.toBe(token);
      await expect(harness.flow.snapshot(confirmed.continuation!)).resolves.toMatchObject({ stage: 'contact_verified' });
      // The old token is only a replay credential now.
      await expect(harness.flow.snapshot(token)).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });

      const password = await harness.flow.choosePassword(as(confirmed.continuation!), { password: PASSWORD });
      expect(password.body).toEqual({ stage: 'registration_in_progress', expiresAt: expect.any(String) });
      expect(Date.parse(password.body.expiresAt)).toBe(harness.clock.now().getTime() + DAY);
    });

    test('stages cannot be skipped', async () => {
      const token = await eligible();
      await expect(harness.flow.choosePassword(as(token), { password: PASSWORD })).rejects.toMatchObject({
        code: 'FLOW_STAGE_CONFLICT',
      });
      await expect(harness.flow.complete(as(token), COMPLETION)).rejects.toMatchObject({ code: 'FLOW_STAGE_CONFLICT' });
      expect(harness.database.state.registrations.size).toBe(0);
    });

    test('an unknown or expired continuation is unauthorized', async () => {
      await expect(harness.flow.snapshot('x'.repeat(43))).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });
      const token = await eligible();
      harness.clock.advance(30 * MINUTE);
      await expect(harness.flow.snapshot(token)).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });
    });

    test('the snapshot exposes the stage and resend window, never ids or contact', async () => {
      const token = await eligible();
      await harness.flow.requestContactVerification(as(token), { contact: CONTACT, originFingerprint: ORIGIN });
      const snapshot = await harness.flow.snapshot(token);

      expect(snapshot).toEqual({
        stage: 'verification_pending',
        expiresAt: new Date(harness.clock.now().getTime() + 15 * MINUTE),
        nextResendAt: new Date(harness.clock.now().getTime() + MINUTE),
      });
    });

    test('activation stays unavailable without approved documents and releases the key', async () => {
      harness.database.state.termsDocuments.clear();
      const token = await incomplete();
      const credentials = as(token);

      await expect(harness.flow.complete(credentials, COMPLETION)).rejects.toMatchObject({
        code: 'ACCOUNT_CANNOT_BE_ACTIVATED',
      });
      expect([...harness.database.state.idempotency.values()].filter((row) => row.operation === 'complete')).toHaveLength(0);
      await expect(harness.legalDocuments.execute({ locale: 'pt-BR' })).resolves.toEqual([]);
    });
  });

  describe('neutrality (RNF004)', () => {
    test('a retained contact gets the same answer and a session that can never verify', async () => {
      await createIncompleteAccount(harness, CONTACT);
      const token = await eligible();
      const sent = harness.delivery.sent.length;

      const result = await harness.flow.requestContactVerification(as(token), {
        contact: CONTACT,
        originFingerprint: ORIGIN,
      });

      expect(Object.keys(result.body).sort()).toEqual(['expiresAt', 'nextResendAt']);
      expect(harness.delivery.sent.slice(sent)).toEqual([expect.objectContaining({ kind: 'recovery_notice' })]);
      const session = sessions().find((row) => row.stage === 'verification_pending');
      expect(session?.verificationId).toBeNull();
      await expect(harness.flow.confirmContact(as(token), { otp: '123456' })).resolves.toEqual({
        body: { verified: false },
        continuation: null,
      });
      await expect(harness.flow.resendContactVerification(as(token))).resolves.toMatchObject({ continuation: null });
    });

    test('the origin limit allows ten challenges per hour, then answers neutrally without a challenge', async () => {
      for (let index = 0; index < 10; index += 1) {
        const token = await eligible();
        await harness.flow.requestContactVerification(as(token), {
          contact: `pessoa${index}@example.test`,
          originFingerprint: ORIGIN,
        });
      }
      const challenges = harness.database.state.verifications.size;
      const token = await eligible();
      const result = await harness.flow.requestContactVerification(as(token), {
        contact: 'outra@example.test',
        originFingerprint: ORIGIN,
      });

      expect(Object.keys(result.body).sort()).toEqual(['expiresAt', 'nextResendAt']);
      expect(harness.database.state.verifications.size).toBe(challenges);
    });
  });

  describe('idempotency and rotation (ADR-021)', () => {
    test('the same key and payload replay the outcome without a new message', async () => {
      const token = await eligible();
      const credentials = as(token);
      const first = await harness.flow.requestContactVerification(credentials, { contact: CONTACT, originFingerprint: ORIGIN });
      const sent = harness.delivery.sent.length;
      harness.clock.advance(5_000);

      const replay = await harness.flow.requestContactVerification(credentials, { contact: CONTACT, originFingerprint: ORIGIN });

      expect(replay).toEqual(first);
      expect(harness.delivery.sent.length).toBe(sent);
    });

    test('the same key with another payload is a conflict', async () => {
      const token = await eligible();
      const credentials = as(token);
      await harness.flow.requestContactVerification(credentials, { contact: CONTACT, originFingerprint: ORIGIN });
      await expect(
        harness.flow.requestContactVerification(credentials, { contact: 'outra@example.test', originFingerprint: ORIGIN }),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    });

    test('a lost rotation is recovered with the previous token and the same key, without repeating the effect', async () => {
      const token = await verified();
      const credentials = as(token);
      const first = await harness.flow.choosePassword(credentials, { password: PASSWORD });
      const registrations = harness.database.state.registrations.size;
      harness.clock.advance(30_000);

      const recovered = await harness.flow.choosePassword(credentials, { password: PASSWORD });

      expect(recovered.body).toEqual(first.body);
      expect(recovered.continuation).not.toBeNull();
      expect(recovered.continuation).not.toBe(first.continuation);
      expect(harness.database.state.registrations.size).toBe(registrations);
      await expect(harness.flow.snapshot(recovered.continuation!)).resolves.toMatchObject({
        stage: 'registration_in_progress',
      });
    });

    test('the previous token never authorizes a new operation and dies after 60 seconds', async () => {
      const token = await verified();
      const credentials = as(token);
      const next = await harness.flow.choosePassword(credentials, { password: PASSWORD });

      await expect(harness.flow.saveRequiredData(as(token), REQUIRED)).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });
      harness.clock.advance(60_000);
      await expect(harness.flow.choosePassword(credentials, { password: PASSWORD })).rejects.toMatchObject({
        code: 'FLOW_UNAUTHORIZED',
      });
      await expect(harness.flow.snapshot(next.continuation!)).resolves.toMatchObject({ stage: 'registration_in_progress' });
    });

    test('a refusal releases the reservation so the same key can be retried', async () => {
      const token = await verified();
      const credentials = as(token);
      await expect(harness.flow.choosePassword(credentials, { password: 'Password1' })).rejects.toMatchObject({
        code: 'WEAK_PASSWORD',
      });
      await expect(harness.flow.choosePassword(credentials, { password: PASSWORD })).resolves.toMatchObject({
        body: { stage: 'registration_in_progress' },
      });
    });

    test('password and birth date never enter the idempotency fingerprint', async () => {
      const token = await incomplete();
      await harness.flow.complete(as(token), COMPLETION);

      const stored = JSON.stringify(
        [...harness.database.state.idempotency.values()].map((row) => [row.requestHash.toString(), row.outcome]),
      );
      expect(stored).not.toContain(PASSWORD);
      expect(stored).not.toContain(ADULT_BIRTH_DATE);
    });

    test('a running reservation is a conflict until its lease expires', async () => {
      const token = await verified();
      const credentials = as(token);
      const session = sessions()[0]!;
      // What a concurrent request holds while its command runs (or after it crashed).
      harness.database.state.idempotency.set('running', {
        id: 'running',
        flowSessionId: session.id,
        operation: 'password',
        keyHash: Buffer.from(`idempotency_key:${credentials.idempotencyKey}`),
        requestHash: Buffer.from('request:password:{}'),
        outcome: null,
        expiresAt: new Date(harness.clock.now().getTime() + 30_000),
      });

      await expect(harness.flow.choosePassword(credentials, { password: PASSWORD })).rejects.toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
      });
      harness.clock.advance(30_000);
      await expect(harness.flow.choosePassword(credentials, { password: PASSWORD })).resolves.toMatchObject({
        body: { stage: 'registration_in_progress' },
      });
    });
  });

  describe('e-mail link (ADR-024)', () => {
    test('confirms once, moves the pending session and issues a new continuation', async () => {
      const token = await eligible();
      await harness.flow.requestContactVerification(as(token), { contact: CONTACT, originFingerprint: ORIGIN });
      const link = harness.delivery.lastLinkToken();

      const confirmed = await harness.flow.confirmContactByLink({ token: link });

      expect(confirmed.body).toEqual({ verified: true });
      await expect(harness.flow.snapshot(confirmed.continuation!)).resolves.toMatchObject({ stage: 'contact_verified' });
      await expect(harness.flow.confirmContactByLink({ token: link })).resolves.toEqual({
        body: { verified: false },
        continuation: null,
      });
    });

    test('an OTP confirmation burns the link, and an expired link fails', async () => {
      const token = await eligible();
      await harness.flow.requestContactVerification(as(token), { contact: CONTACT, originFingerprint: ORIGIN });
      const link = harness.delivery.lastLinkToken();
      await harness.flow.confirmContact(as(token), { otp: harness.delivery.lastOtp() });
      await expect(harness.flow.confirmContactByLink({ token: link })).resolves.toMatchObject({ body: { verified: false } });

      const other = await eligible();
      await harness.flow.requestContactVerification(as(other), { contact: 'bia@example.test', originFingerprint: ORIGIN });
      const expired = harness.delivery.lastLinkToken();
      harness.clock.advance(15 * MINUTE);
      await expect(harness.flow.confirmContactByLink({ token: expired })).resolves.toMatchObject({ body: { verified: false } });
    });

    test('a resend replaces the link', async () => {
      const token = await eligible();
      await harness.flow.requestContactVerification(as(token), { contact: CONTACT, originFingerprint: ORIGIN });
      const first = harness.delivery.lastLinkToken();
      harness.clock.advance(MINUTE);
      await harness.flow.resendContactVerification(as(token));

      await expect(harness.flow.confirmContactByLink({ token: first })).resolves.toMatchObject({ body: { verified: false } });
      await expect(harness.flow.confirmContactByLink({ token: harness.delivery.lastLinkToken() })).resolves.toMatchObject({
        body: { verified: true },
      });
    });
  });

  test('stale expiration nulls the digests of expired sessions', async () => {
    await eligible();
    harness.clock.advance(31 * MINUTE);
    await expect(harness.expireStale.execute()).resolves.toMatchObject({ sessions: 1 });
    expect(sessions()[0]?.tokenDigest).toBeNull();
  });
});
