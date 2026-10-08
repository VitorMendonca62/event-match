import { beforeEach, describe, expect, test } from 'bun:test';

import type { FlowCredentials } from '../../../src/modules/registration/application/services/registration-flow-gate';
import {
  ADULT_BIRTH_DATE,
  createRegistrationHarness,
  DOCUMENTS,
  INTEREST_IDS,
  seedCatalogAndTerms,
  type RegistrationHarness,
} from '../../support/registration-fakes';

const CONTACT = 'ana@example.test';
const ORIGIN = Buffer.alloc(32, 9);
const PASSWORD = 'uma senha longa';
const REQUIRED = { displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'] };

describe('CancelRegistration (ADR-030)', () => {
  let harness: RegistrationHarness;
  let keys = 0;

  beforeEach(() => {
    harness = createRegistrationHarness();
    seedCatalogAndTerms(harness);
    keys = 0;
  });

  const as = (token: string): FlowCredentials => ({ token, idempotencyKey: `idempotency-key-${String((keys += 1)).padStart(4, '0')}` });
  const sessions = () => [...harness.database.state.sessions.values()];

  async function verified(): Promise<string> {
    const eligibility = await harness.eligibility.execute({ birthDate: ADULT_BIRTH_DATE });
    if (!eligibility.eligible) throw new Error('expected eligibility');
    const token = eligibility.continuation;
    await harness.flow.requestContactVerification(as(token), { contact: CONTACT, originFingerprint: ORIGIN });
    const confirmed = await harness.flow.confirmContact(as(token), { otp: harness.delivery.lastOtp() });
    return confirmed.continuation!;
  }

  test('after the password the registration expires, its data is nulled and the token dies', async () => {
    const afterPassword = await harness.flow.choosePassword(as(await verified()), { password: PASSWORD });
    const token = afterPassword.continuation!;
    const [registrationBefore] = [...harness.database.state.registrations.values()];
    expect(registrationBefore).toMatchObject({ status: 'registration_in_progress' });

    await harness.cancel.execute(token);

    const [registration] = [...harness.database.state.registrations.values()];
    expect(registration).toMatchObject({ status: 'expired', retained: null });
    expect(sessions()[0]).toMatchObject({ tokenDigest: null, previousTokenDigest: null, revokedAt: harness.clock.now() });
    await expect(harness.flow.snapshot(token)).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });
    expect(harness.telemetry.events.at(-1)).toMatchObject({
      name: 'registration.cancelled',
      outcome: 'registration_in_progress',
    });
  });

  test('the contact is released so the same e-mail can register again', async () => {
    const afterPassword = await harness.flow.choosePassword(as(await verified()), { password: PASSWORD });
    await harness.cancel.execute(afterPassword.continuation!);

    const again = await harness.eligibility.execute({ birthDate: ADULT_BIRTH_DATE });
    if (!again.eligible) throw new Error('expected eligibility');
    await harness.flow.requestContactVerification(as(again.continuation), { contact: CONTACT, originFingerprint: ORIGIN });
    const confirmed = await harness.flow.confirmContact(as(again.continuation), { otp: harness.delivery.lastOtp() });
    await expect(harness.flow.choosePassword(as(confirmed.continuation!), { password: PASSWORD })).resolves.toMatchObject({
      body: { stage: 'registration_in_progress' },
    });
  });

  test('an incomplete account expires and its personal data is erased', async () => {
    const afterPassword = await harness.flow.choosePassword(as(await verified()), { password: PASSWORD });
    const afterRequired = await harness.flow.saveRequiredData(as(afterPassword.continuation!), REQUIRED);
    const [accountId] = [...harness.database.state.accounts.keys()];

    await harness.cancel.execute(afterRequired.continuation!);

    expect(harness.database.state.accounts.get(accountId!)).toMatchObject({ status: 'expired', birthDate: null });
    expect(harness.database.state.profiles.get(accountId!)).toEqual({ displayName: null, ufCode: null, municipalityCode: null });
    expect(harness.database.state.acceptances.size).toBe(0);
    expect(harness.telemetry.events.at(-1)).toMatchObject({ outcome: 'account_incomplete' });
  });

  test('before any registration only the continuation is revoked', async () => {
    const token = await verified();

    await harness.cancel.execute(token);

    expect(harness.database.state.registrations.size).toBe(0);
    expect(sessions()[0]).toMatchObject({ tokenDigest: null });
  });

  test('an unknown, repeated or previous token cannot cancel and changes nothing', async () => {
    const afterPassword = await harness.flow.choosePassword(as(await verified()), { password: PASSWORD });
    await expect(harness.cancel.execute('x'.repeat(43))).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });
    expect([...harness.database.state.registrations.values()][0]).toMatchObject({ status: 'registration_in_progress' });

    await harness.cancel.execute(afterPassword.continuation!);
    await expect(harness.cancel.execute(afterPassword.continuation!)).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });
  });

  test('an active account and a completed session are never touched', async () => {
    const afterPassword = await harness.flow.choosePassword(as(await verified()), { password: PASSWORD });
    const afterRequired = await harness.flow.saveRequiredData(as(afterPassword.continuation!), REQUIRED);
    await harness.flow.complete(as(afterRequired.continuation!), {
      birthDate: ADULT_BIRTH_DATE,
      documentIds: Object.values(DOCUMENTS),
      interestIds: INTEREST_IDS.slice(0, 3),
    });
    const [accountId] = [...harness.database.state.accounts.keys()];

    await expect(harness.cancel.execute(afterRequired.continuation!)).rejects.toMatchObject({ code: 'FLOW_UNAUTHORIZED' });
    expect(harness.database.state.accounts.get(accountId!)).toMatchObject({ status: 'active' });
  });
});
