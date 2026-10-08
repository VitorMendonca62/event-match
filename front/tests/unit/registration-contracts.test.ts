import { describe, expect, test } from 'bun:test';

import {
  birthDateSchema,
  completeRequestSchema,
  confirmContactRequestSchema,
  contactVerificationRequestSchema,
  passwordRequestSchema,
  requiredDataRequestSchema,
  snapshotDataSchema,
} from '../../src/features/registration/contracts';

const UUID = '0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f50';

describe('registration contracts', () => {
  test('accepts real calendar dates only', () => {
    expect(birthDateSchema.safeParse('1990-05-10').success).toBe(true);
    expect(birthDateSchema.safeParse('2023-02-30').success).toBe(false);
    expect(birthDateSchema.safeParse('10/05/1990').success).toBe(false);
  });

  test('publishes only the e-mail channel and rejects extra properties', () => {
    expect(contactVerificationRequestSchema.safeParse({ channel: 'email', contact: 'pessoa@example.test' }).success).toBe(true);
    expect(contactVerificationRequestSchema.safeParse({ channel: 'whatsapp', contact: 'pessoa@example.test' }).success).toBe(false);
    expect(
      contactVerificationRequestSchema.safeParse({ channel: 'email', contact: 'pessoa@example.test', phone: '1' }).success,
    ).toBe(false);
  });

  test('keeps OTP, password and profile limits of the OpenAPI', () => {
    expect(confirmContactRequestSchema.safeParse({ otp: '123456' }).success).toBe(true);
    expect(confirmContactRequestSchema.safeParse({ otp: '12345a' }).success).toBe(false);
    expect(passwordRequestSchema.safeParse({ password: 'curta', passwordConfirmation: 'curta' }).success).toBe(false);
    expect(passwordRequestSchema.safeParse({ password: 'uma frase longa', passwordConfirmation: 'outra frase' }).success).toBe(false);
    expect(
      requiredDataRequestSchema.safeParse({ displayName: 'x'.repeat(61), ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'] }).success,
    ).toBe(false);
    expect(
      requiredDataRequestSchema.safeParse({ displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship', 'friendship'] })
        .success,
    ).toBe(false);
  });

  test('requires unique uuids on completion', () => {
    expect(completeRequestSchema.safeParse({ birthDate: '1990-05-10', documentIds: [UUID], interestIds: [UUID] }).success).toBe(true);
    expect(
      completeRequestSchema.safeParse({ birthDate: '1990-05-10', documentIds: [UUID, UUID], interestIds: [UUID] }).success,
    ).toBe(false);
  });

  test('snapshot exposes stage and instants only', () => {
    const parsed = snapshotDataSchema.parse({
      stage: 'verification_pending',
      expiresAt: '2026-09-26T12:15:00.000Z',
      nextResendAt: '2026-09-26T12:01:00.000Z',
      contact: 'pessoa@example.test',
    });
    expect(Object.keys(parsed).sort()).toEqual(['expiresAt', 'nextResendAt', 'stage']);
  });
});
