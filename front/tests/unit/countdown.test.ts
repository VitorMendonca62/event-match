import { describe, expect, test } from 'bun:test';

import { formatClock, secondsUntil } from '../../src/features/registration/countdown';

const AT = '2026-09-26T12:01:00.000Z';
const ms = Date.parse(AT);

describe('countdown', () => {
  test('counts down from absolute instants and never goes negative', () => {
    expect(secondsUntil(AT, ms - 60_000)).toBe(60);
    expect(secondsUntil(AT, ms - 500)).toBe(1);
    expect(secondsUntil(AT, ms)).toBe(0);
    expect(secondsUntil(AT, ms + 5_000)).toBe(0);
  });

  test('a suspended tab is corrected on the next reading', () => {
    // Ten minutes asleep: the next tick recomputes from the clock, not from the previous value.
    expect(secondsUntil(AT, ms - 15 * 60_000 + 10 * 60_000)).toBe(300);
  });

  test('handles absent or invalid instants and formats m:ss', () => {
    expect(secondsUntil(undefined, ms)).toBe(0);
    expect(secondsUntil('not-a-date', ms)).toBe(0);
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(900)).toBe('15:00');
  });
});
