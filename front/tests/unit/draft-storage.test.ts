import { describe, expect, test } from 'bun:test';

import {
  clearDraft,
  DRAFT_STORAGE_KEY,
  DRAFT_TTL_MS,
  readDraft,
  writeDraft,
} from '../../src/features/registration/draft-storage';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const T0 = new Date('2026-09-26T12:00:00.000Z');
const later = (ms: number) => new Date(T0.getTime() + ms);
const UUID = '0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f50';

const FORBIDDEN = [
  'contact',
  'email',
  'otp',
  'password',
  'passwordConfirmation',
  'birthDate',
  'token',
  'continuation',
  'documentIds',
  'accepted',
  'idempotencyKey',
] as const;

describe('registration draft storage', () => {
  test('writes schema v1 with an allowlist and renews touchedAt', () => {
    const storage = memoryStorage();
    writeDraft(storage, { localStep: 'required_data', displayName: 'Ana' }, T0);
    const draft = writeDraft(storage, { region: 'Recife' }, later(60_000));
    expect(draft).toMatchObject({ schemaVersion: 1, localStep: 'required_data', displayName: 'Ana', region: 'Recife' });
    expect(draft?.touchedAt).toBe(later(60_000).toISOString());
  });

  test('never persists forbidden fields, even when a caller passes them', () => {
    const storage = memoryStorage();
    const hostile = Object.fromEntries(FORBIDDEN.map((key) => [key, 'secret-value']));
    writeDraft(storage, { localStep: 'interests', interestIds: [UUID], ...hostile } as never, T0);
    const raw = storage.map.get(DRAFT_STORAGE_KEY) ?? '';
    for (const key of FORBIDDEN) expect(raw).not.toContain(`"${key}"`);
    expect(raw).not.toContain('secret-value');
  });

  test('expires after 30 minutes of inactivity (sliding window)', () => {
    const storage = memoryStorage();
    writeDraft(storage, { localStep: 'otp' }, T0);
    writeDraft(storage, { localStep: 'password' }, later(DRAFT_TTL_MS - 1000));
    expect(readDraft(storage, later(2 * DRAFT_TTL_MS - 2000))?.localStep).toBe('password');
    expect(readDraft(storage, later(2 * DRAFT_TTL_MS))).toBeUndefined();
    expect(storage.map.has(DRAFT_STORAGE_KEY)).toBe(false);
  });

  test('clears corrupted JSON, unknown versions and unknown keys', () => {
    const storage = memoryStorage();
    storage.setItem(DRAFT_STORAGE_KEY, '{not json');
    expect(readDraft(storage, T0)).toBeUndefined();
    expect(storage.map.size).toBe(0);

    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, touchedAt: T0.toISOString(), localStep: 'otp' }));
    expect(readDraft(storage, T0)).toBeUndefined();

    storage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, touchedAt: T0.toISOString(), localStep: 'otp', contact: 'a@example.test' }),
    );
    expect(readDraft(storage, T0)).toBeUndefined();
    expect(storage.map.size).toBe(0);
  });

  test('clearDraft removes the whole key and tolerates unavailable storage', () => {
    const storage = memoryStorage();
    writeDraft(storage, { localStep: 'legal' }, T0);
    clearDraft(storage);
    expect(storage.map.size).toBe(0);

    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readDraft(broken, T0)).toBeUndefined();
    expect(() => writeDraft(broken, { localStep: 'legal' }, T0)).not.toThrow();
    expect(() => clearDraft(broken)).not.toThrow();
  });
});
