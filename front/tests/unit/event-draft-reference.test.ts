import { describe, expect, test } from 'bun:test';

import { clearEventDraftReference, getEventDraftReference, readEventDraftReference, saveEventDraftReference } from '../../src/features/events/draft-reference';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const KEY = 'eventmatch:event-draft-reference:v1';

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('event draft session reference', () => {
  test('stores only a versioned UUID and a sliding timestamp', () => {
    const storage = createStorage();
    expect(saveEventDraftReference(storage, ID, 1_000)).toBe(true);
    expect(JSON.parse(storage.values.get(KEY) ?? 'null')).toEqual({ version: 1, eventId: ID, touchedAt: 1_000 });
    expect(readEventDraftReference(storage, 2_000)).toBe(ID);
    expect(JSON.parse(storage.values.get(KEY) ?? 'null')).toEqual({ version: 1, eventId: ID, touchedAt: 2_000 });
  });

  test('provides a pure snapshot without renewing the sliding timestamp', () => {
    const storage = createStorage();
    saveEventDraftReference(storage, ID, 1_000);
    expect(getEventDraftReference(storage, 2_000)).toBe(ID);
    expect(JSON.parse(storage.values.get(KEY) ?? 'null')).toEqual({ version: 1, eventId: ID, touchedAt: 1_000 });
    expect(getEventDraftReference(storage, 30 * 60 * 1000 + 1_000)).toBeUndefined();
  });

  test('removes expired, malformed, unknown-version and extra-field entries', () => {
    const storage = createStorage();
    for (const value of [
      '{broken',
      JSON.stringify({ version: 2, eventId: ID, touchedAt: 1_000 }),
      JSON.stringify({ version: 1, eventId: ID, touchedAt: 1_000, title: 'private content' }),
      JSON.stringify({ version: 1, eventId: ID, touchedAt: 1_000 }),
    ]) {
      storage.setItem(KEY, value);
      expect(readEventDraftReference(storage, 1_000 + 30 * 60 * 1000)).toBeUndefined();
      expect(storage.getItem(KEY)).toBeNull();
    }
  });

  test('rejects unsafe ids and tolerates storage being unavailable', () => {
    const storage = createStorage();
    expect(saveEventDraftReference(storage, 'not-a-uuid', 1_000)).toBe(false);
    expect(readEventDraftReference(storage, 1_000)).toBeUndefined();
    expect(saveEventDraftReference(undefined, ID, 1_000)).toBe(false);
    expect(readEventDraftReference(undefined, 1_000)).toBeUndefined();
    expect(() => clearEventDraftReference(undefined)).not.toThrow();
  });

  test('clears the reference explicitly', () => {
    const storage = createStorage();
    saveEventDraftReference(storage, ID, 1_000);
    clearEventDraftReference(storage);
    expect(storage.getItem(KEY)).toBeNull();
  });
});
