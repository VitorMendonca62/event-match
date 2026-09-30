import { describe, expect, test } from 'bun:test';

import { AuthenticatedSession } from '../../../src/modules/identity-access/domain/entities/authenticated-session';
import {
  ACCOUNT_STATUSES,
  canHoldCommonSession,
  isAccountStatus,
} from '../../../src/modules/identity-access/domain/value-objects/account-access';
import { LoginEmail } from '../../../src/modules/identity-access/domain/value-objects/login-email';
import { DAY, DEFAULT_POLICY, HOUR, MINUTE } from '../../support/identity-access-fakes';

const NOW = new Date('2026-09-29T12:00:00.000Z');
const at = (milliseconds: number) => new Date(NOW.getTime() + milliseconds);
const digest = (fill: number) => new Uint8Array(32).fill(fill);

function start(mode: 'browser' | 'remembered') {
  return AuthenticatedSession.start(
    { id: 'session-1', accountId: 'account-1', tokenDigest: digest(1), mode },
    NOW,
    DEFAULT_POLICY,
  );
}

describe('AuthenticatedSession (ADR-033)', () => {
  test('a browser session lasts 12 h absolute and 30 min idle, with exclusive deadlines', () => {
    const session = start('browser');
    expect(session.remembered).toBe(false);
    expect(session.absoluteExpiresAt).toEqual(at(12 * HOUR));
    expect(session.idleExpiresAt).toEqual(at(30 * MINUTE));
    expect(session.expiry(at(30 * MINUTE - 1))).toBeNull();
    expect(session.expiry(at(30 * MINUTE))).toBe('idle');
  });

  test('a remembered session lasts 30 d absolute and 7 d idle', () => {
    const session = start('remembered');
    expect(session.absoluteExpiresAt).toEqual(at(30 * DAY));
    expect(session.idleExpiresAt).toEqual(at(7 * DAY));
    expect(session.expiry(at(7 * DAY - 1))).toBeNull();
    expect(session.expiry(at(7 * DAY))).toBe('idle');
  });

  test('activity renews only the idle deadline and never the absolute one', () => {
    let session = start('browser');
    for (let minute = 25; minute < 12 * 60; minute += 25) session = session.touch(at(minute * MINUTE));
    expect(session.absoluteExpiresAt).toEqual(at(12 * HOUR));
    expect(session.idleExpiresAt.getTime()).toBeLessThanOrEqual(session.absoluteExpiresAt.getTime());
    expect(session.expiry(at(12 * HOUR - 1))).toBeNull();
    expect(session.expiry(at(12 * HOUR))).toBe('absolute');
  });

  test('activity writes are amortized to one per five minutes', () => {
    const session = start('browser');
    expect(session.activityWriteDue(at(5 * MINUTE - 1), DEFAULT_POLICY)).toBe(false);
    expect(session.activityWriteDue(at(5 * MINUTE), DEFAULT_POLICY)).toBe(true);
  });

  test('browser sessions never rotate periodically; remembered ones rotate every 24 h', () => {
    expect(start('browser').rotationDue(at(11 * HOUR), DEFAULT_POLICY)).toBe(false);
    const remembered = start('remembered');
    expect(remembered.rotationDue(at(DAY - 1), DEFAULT_POLICY)).toBe(false);
    expect(remembered.rotationDue(at(DAY), DEFAULT_POLICY)).toBe(true);
  });

  test('rotation keeps the previous digest for the grace only and extends nothing', () => {
    const session = start('remembered').touch(at(DAY - HOUR));
    const rotated = session.rotate(digest(2), at(DAY), DEFAULT_POLICY);
    expect(rotated.tokenDigest).toEqual(digest(2));
    expect(rotated.previousTokenDigest).toEqual(digest(1));
    expect(rotated.acceptsPrevious(at(DAY + MINUTE - 1))).toBe(true);
    expect(rotated.acceptsPrevious(at(DAY + MINUTE))).toBe(false);
    expect(rotated.absoluteExpiresAt).toEqual(session.absoluteExpiresAt);
    expect(rotated.lastSeenAt).toEqual(session.lastSeenAt);
    expect(rotated.rotationDue(at(DAY + HOUR), DEFAULT_POLICY)).toBe(false);
  });
});

describe('account access values (ADR-036)', () => {
  test('recognizes every canonical state and only active holds a common session', () => {
    expect(ACCOUNT_STATUSES).toHaveLength(10);
    expect(ACCOUNT_STATUSES.filter(canHoldCommonSession)).toEqual(['active']);
    expect(isAccountStatus('suspended')).toBe(true);
    expect(isAccountStatus('admin')).toBe(false);
  });

  test('normalizes the login e-mail like registration and refuses what cannot be normalized', () => {
    expect(LoginEmail.normalize('  Ana@Example.TEST ')?.value).toBe('ana@example.test');
    expect(LoginEmail.normalize('not an e-mail')).toBeNull();
  });
});
