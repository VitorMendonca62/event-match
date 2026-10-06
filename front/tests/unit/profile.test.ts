import { describe, expect, test } from 'bun:test';
import { invitationDismissed, profileInvitationCookieName, serializeInvitationCookie } from '../../src/shared/server/profile-invitation-cookie';
import { profilePhotoSchema, updateProfileSchema } from '../../src/features/profile/contracts';
import { getCropFrame, isProfileImageLargeEnough } from '../../src/features/profile/profile-image-crop';
import { profileScrollBehavior } from '../../src/features/profile/profile-motion';

const NOW = new Date('2026-10-01T12:00:00.000Z');
const SUBJECT = `v1.${'A'.repeat(43)}`;

describe('profile invitation cookie (ADR-040)', () => {
  test('uses __Host in production and isolates a dismissal by subject and deadline', () => {
    expect(profileInvitationCookieName({ NODE_ENV: 'production' })).toBe('__Host-eventmatch_profile_invite');
    const serialized = serializeInvitationCookie(SUBJECT, { NODE_ENV: 'production' }, NOW);
    expect(serialized).toContain('HttpOnly; SameSite=Lax; Secure'); expect(serialized).not.toContain('Domain');
    const value = serialized.split(';')[0]?.split('=').slice(1).join('=');
    expect(invitationDismissed(value, SUBJECT, NOW)).toBe(true);
    expect(invitationDismissed(value, `v1.${'B'.repeat(43)}`, NOW)).toBe(false);
  });
  test('ignores malformed and overlong deadlines', () => {
    expect(invitationDismissed(`${SUBJECT}.${NOW.getTime() + 8 * 86_400_000}`, SUBJECT, NOW)).toBe(false);
    expect(invitationDismissed('forged', SUBJECT, NOW)).toBe(false);
  });
});

test('profile update rejects public visibility, duplicate intents and fewer than three interests', () => {
  const value = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship', 'friendship'], interestIds: [crypto.randomUUID()], presentation: null, photoVisibility: 'public', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private' };
  expect(updateProfileSchema.safeParse(value).success).toBe(false);
});

test('optional identity requires coherent pronouns and at most five unique languages', () => {
  const base = { revision: 1, displayName: 'Ana', region: 'Centro', usageIntents: ['friendship'], interestIds: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()], presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: 'other', customPronouns: 'elu/delu', pronounsVisibility: 'authenticated', profession: 'Pessoa desenvolvedora', professionVisibility: 'private', languageCodes: ['pt', 'bzs'], languagesVisibility: 'authenticated' };
  expect(updateProfileSchema.safeParse(base).success).toBeTrue();
  expect(updateProfileSchema.safeParse({ ...base, customPronouns: null }).success).toBeFalse();
  expect(updateProfileSchema.safeParse({ ...base, pronounSelection: 'prefer_not_to_say', customPronouns: null, pronounsVisibility: 'authenticated' }).success).toBeFalse();
  expect(updateProfileSchema.safeParse({ ...base, languageCodes: ['pt', 'pt'] }).success).toBeFalse();
});

test('profile photo contract does not advertise an expiration deadline', () => {
  const photo = { deliveryUrl: 'https://media.example.test/photo.webp', width: 512, height: 512 } as const;
  expect(profilePhotoSchema.parse(photo)).toEqual(photo);
  expect(profilePhotoSchema.safeParse({ ...photo, expiresAt: '2026-10-03T12:05:00.000Z' }).success).toBeFalse();
});

test('profile crop frame maps a square source region into the 4:3 editor stage', () => {
  const frame = getCropFrame({ width: 800, height: 400 }, 100, 100, 2);
  expect(Number.parseFloat(String(frame.style.left))).toBeCloseTo(75);
  expect(Number.parseFloat(String(frame.style.top))).toBeCloseTo(50);
  expect(Number.parseFloat(String(frame.style.width))).toBeCloseTo(25);
  expect(Number.parseFloat(String(frame.style.height))).toBeCloseTo(33.3333);
  expect(frame.maxLeftPercent).toBe(75);
  expect(frame.maxTopPercent).toBeCloseTo(33.3333);
});

test('profile photo dimensions enforce the 320 px minimum on both axes', () => {
  expect(isProfileImageLargeEnough({ width: 320, height: 320 })).toBeTrue();
  expect(isProfileImageLargeEnough({ width: 319, height: 800 })).toBeFalse();
  expect(isProfileImageLargeEnough({ width: 800, height: 319 })).toBeFalse();
});

test('profile scrolling respects reduced motion', () => {
  expect(profileScrollBehavior(true)).toBe('auto');
  expect(profileScrollBehavior(false)).toBe('smooth');
});
