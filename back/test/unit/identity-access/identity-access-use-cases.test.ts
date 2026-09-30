import { beforeEach, describe, expect, test } from 'bun:test';

import {
  IdentityAccessError,
  type IdentityAccessErrorCode,
} from '../../../src/modules/identity-access/domain/errors/identity-access.error';
import { ACCOUNT_STATUSES } from '../../../src/modules/identity-access/domain/value-objects/account-access';
import {
  createIdentityHarness,
  DAY,
  type IdentityHarness,
  MINUTE,
  ORIGIN,
} from '../../support/identity-access-fakes';

const EMAIL = 'ana@example.test';
const PASSWORD = 'uma senha longa e rara';

async function rejection(promise: Promise<unknown>): Promise<IdentityAccessErrorCode> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof IdentityAccessError) return error.code;
    throw error;
  }
  throw new Error('expected a rejection');
}

describe('AuthenticateAccount', () => {
  let h: IdentityHarness;
  let accountId: string;
  const login = (overrides: Partial<{ email: string; password: string; rememberMe: boolean; originFingerprint: Uint8Array }> = {}) =>
    h.authenticate.execute({ email: EMAIL, password: PASSWORD, rememberMe: false, originFingerprint: ORIGIN, ...overrides });

  beforeEach(() => {
    h = createIdentityHarness();
    accountId = h.addAccount(EMAIL, PASSWORD);
  });

  test('an active account with the right password gets a fresh session and releases its reservation', async () => {
    const result = await login({ email: '  ANA@example.test ' });

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.remembered).toBe(false);
    expect(result.expiresAt.getTime() - h.clock.now().getTime()).toBe(12 * 60 * MINUTE);
    expect(h.database.state.sessions.size).toBe(1);
    const [session] = h.database.state.sessions.values();
    expect(session?.accountId).toBe(accountId);
    expect(Buffer.from(session!.tokenDigest).toString('base64url')).not.toBe(result.token);
    expect(h.database.state.attempts).toHaveLength(0);
    expect(h.verifier.real).toBe(1);
    expect(h.telemetry.events.at(-1)).toMatchObject({ name: 'login', outcome: 'success' });
  });

  test('remember me yields a 30-day session', async () => {
    const result = await login({ rememberMe: true });
    expect(result.remembered).toBe(true);
    expect(result.expiresAt.getTime() - h.clock.now().getTime()).toBe(30 * DAY);
  });

  test('unknown e-mail, wrong password, missing hash and every non-active state fail identically', async () => {
    h.addAccount('sem-senha@example.test', null);
    const codes = [
      await rejection(login({ email: 'ninguem@example.test' })),
      await rejection(login({ password: 'outra senha qualquer' })),
      await rejection(login({ email: 'sem-senha@example.test' })),
      await rejection(login({ email: 'invalido' })),
    ];
    for (const status of ACCOUNT_STATUSES.filter((value) => value !== 'active')) {
      h.addAccount(`${status}@example.test`, PASSWORD, status);
      codes.push(await rejection(login({ email: `${status}@example.test` })));
    }

    expect(new Set(codes)).toEqual(new Set(['INVALID_CREDENTIALS']));
    expect(h.database.state.sessions.size).toBe(0);
    // Unknown, hashless and unnormalizable contacts pay the dummy verification; others the real one.
    expect(h.verifier.dummy).toBe(3);
    expect(h.verifier.real).toBe(1 + ACCOUNT_STATUSES.length - 1);
    expect(h.telemetry.events.every((event) => !JSON.stringify(event).includes('example.test'))).toBe(true);
  });

  test('a denied capability refuses the login neutrally', async () => {
    h.accessPolicy.denied.add('authenticated_home');
    expect(await rejection(login())).toBe('INVALID_CREDENTIALS');
    expect(h.database.state.sessions.size).toBe(0);
  });

  test('an internal verification error is never turned into invalid credentials', async () => {
    h.verifier.failWith = new Error('boom');
    await expect(login()).rejects.toThrow('boom');
  });

  test('five failures on one contact limit it for 15 sliding minutes, without permanent lockout', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await rejection(login({ password: 'errada' }))).toBe('INVALID_CREDENTIALS');
      h.clock.advance(MINUTE);
    }
    expect(await rejection(login())).toBe('RATE_LIMITED');
    expect(h.verifier.real).toBe(5);
    expect(h.accounts.lookups).toBe(5);
    expect(h.telemetry.events.at(-1)).toMatchObject({ outcome: 'rate_limited', scope: 'contact' });

    h.clock.advance(11 * MINUTE); // the first failure leaves the window
    await expect(login()).resolves.toMatchObject({ remembered: false });
  });

  test('unknown contacts consume the contact bucket exactly like existing ones', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) await rejection(login({ email: 'ninguem@example.test' }));
    expect(await rejection(login({ email: 'ninguem@example.test' }))).toBe('RATE_LIMITED');
  });

  test('thirty failures from one origin limit every contact from it', async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) await rejection(login({ email: `p${attempt}@example.test` }));
    expect(await rejection(login())).toBe('RATE_LIMITED');
    expect(h.telemetry.events.at(-1)).toMatchObject({ scope: 'origin' });
    await expect(login({ originFingerprint: Buffer.alloc(32, 1) })).resolves.toBeDefined();
  });

  test('repeated successful logins never consume the limits', async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) await login();
    expect(h.database.state.attempts).toHaveLength(0);
  });

  test('the sixth login evicts the least recently used session and keeps the other four', async () => {
    const tokens: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      tokens.push((await login()).token);
      h.clock.advance(MINUTE);
    }
    // Activity on the first session makes the second one the least recently used.
    h.clock.advance(5 * MINUTE);
    await h.resolve.execute({ token: tokens[0]!, capability: 'authenticated_home', allowRotation: false });

    await login();
    expect(h.database.state.sessions.size).toBe(5);
    expect(await rejection(h.resolve.execute({ token: tokens[1]!, capability: 'authenticated_home', allowRotation: false }))).toBe(
      'SESSION_REVOKED',
    );
    for (const token of [tokens[0]!, ...tokens.slice(2)]) {
      await expect(h.resolve.execute({ token, capability: 'authenticated_home', allowRotation: false })).resolves.toBeDefined();
    }
    expect(h.telemetry.events.filter((event) => event.name === 'login').at(-1)).toMatchObject({ count: 1 });
  });

  test('a state change between lookup and insert refuses the login and keeps the failure counted', async () => {
    const original = h.accounts.findStatus.bind(h.accounts);
    h.accounts.findStatus = async (context, id) => {
      h.database.state.accounts.get(id)!.status = 'suspended';
      return original(context, id);
    };
    expect(await rejection(login())).toBe('INVALID_CREDENTIALS');
    expect(h.database.state.sessions.size).toBe(0);
    expect(h.database.state.attempts).toHaveLength(2);
  });
});

describe('ResolveAuthenticatedSession', () => {
  let h: IdentityHarness;
  let accountId: string;
  const resolve = (token: string, allowRotation = false) =>
    h.resolve.execute({ token, capability: 'authenticated_home', allowRotation });
  const login = async (rememberMe = false) =>
    (await h.authenticate.execute({ email: EMAIL, password: PASSWORD, rememberMe, originFingerprint: ORIGIN })).token;

  beforeEach(() => {
    h = createIdentityHarness();
    accountId = h.addAccount(EMAIL, PASSWORD);
  });

  test('resolves identity and deadlines without copying status or permissions', async () => {
    const token = await login();
    const resolved = await resolve(token);
    expect(resolved).toMatchObject({ accountId, remembered: false, rotationDue: false, rotatedToken: null });
  });

  test('unknown tokens and logged-out sessions are refused', async () => {
    expect(await rejection(resolve('A'.repeat(43)))).toBe('SESSION_REVOKED');
    const token = await login();
    await h.logout.execute({ token });
    expect(await rejection(resolve(token))).toBe('SESSION_REVOKED');
  });

  test('idle expiry removes the session; amortized activity keeps it alive', async () => {
    const token = await login();
    h.clock.advance(20 * MINUTE);
    await resolve(token);
    h.clock.advance(20 * MINUTE);
    await expect(resolve(token)).resolves.toBeDefined();
    h.clock.advance(30 * MINUTE);
    expect(await rejection(resolve(token))).toBe('SESSION_EXPIRED');
    expect(h.database.state.sessions.size).toBe(0);
  });

  test('activity is written at most once every five minutes', async () => {
    const token = await login();
    const [created] = h.database.state.sessions.values();
    h.clock.advance(4 * MINUTE);
    await resolve(token);
    expect([...h.database.state.sessions.values()][0]!.lastSeenAt).toEqual(created!.lastSeenAt);
    h.clock.advance(MINUTE);
    await resolve(token);
    expect([...h.database.state.sessions.values()][0]!.lastSeenAt).toEqual(h.clock.now());
  });

  test('the absolute deadline is final even with continuous activity', async () => {
    const token = await login();
    for (let minute = 0; minute < 12 * 60 - 20; minute += 20) {
      h.clock.advance(20 * MINUTE);
      await resolve(token);
    }
    h.clock.advance(20 * MINUTE);
    expect(await rejection(resolve(token))).toBe('SESSION_EXPIRED');
  });

  test('an account that leaves active loses its session immediately (401 + revocation)', async () => {
    const token = await login();
    h.database.state.accounts.get(accountId)!.status = 'suspended';
    expect(await rejection(resolve(token))).toBe('SESSION_REVOKED');
    h.database.state.accounts.get(accountId)!.status = 'active';
    expect(await rejection(resolve(token))).toBe('SESSION_REVOKED');
  });

  test('a denied capability on an active account is 403 and keeps the session', async () => {
    const token = await login();
    h.accessPolicy.denied.add('authenticated_home');
    expect(await rejection(resolve(token))).toBe('CAPABILITY_DENIED');
    expect(h.database.state.sessions.size).toBe(1);
    h.accessPolicy.denied.clear();
    await expect(resolve(token)).resolves.toBeDefined();
  });

  test('remembered sessions report rotation as due and rotate only when allowed, once', async () => {
    const token = await login(true);
    h.clock.advance(DAY);
    const reported = await resolve(token);
    expect(reported).toMatchObject({ rotationDue: true, rotatedToken: null });

    const rotated = await resolve(token, true);
    expect(rotated.rotatedToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rotated.expiresAt).toEqual(reported.expiresAt);

    // The loser of a concurrent rotation matches the previous digest and never rotates again.
    const loser = await resolve(token, true);
    expect(loser).toMatchObject({ rotatedToken: null, rotationDue: false });

    await expect(resolve(rotated.rotatedToken!)).resolves.toBeDefined();
    h.clock.advance(MINUTE);
    expect(await rejection(resolve(token))).toBe('SESSION_REVOKED');
    await expect(resolve(rotated.rotatedToken!)).resolves.toBeDefined();
    expect(h.telemetry.events.filter((event) => event.name === 'session.rotated')).toHaveLength(1);
  });

  test('browser sessions never rotate', async () => {
    const token = await login(false);
    h.clock.advance(20 * MINUTE);
    expect(await resolve(token, true)).toMatchObject({ rotationDue: false, rotatedToken: null });
  });
});

describe('Logout', () => {
  test('revokes only the current session and is idempotent for the person', async () => {
    const h = createIdentityHarness();
    h.addAccount(EMAIL, PASSWORD);
    const input = { email: EMAIL, password: PASSWORD, rememberMe: false, originFingerprint: ORIGIN };
    const first = (await h.authenticate.execute(input)).token;
    const second = (await h.authenticate.execute(input)).token;

    await expect(h.logout.execute({ token: first })).resolves.toEqual({ loggedOut: true });
    await expect(h.logout.execute({ token: first })).resolves.toEqual({ loggedOut: true });
    expect(await rejection(h.resolve.execute({ token: first, capability: 'logout', allowRotation: false }))).toBe(
      'SESSION_REVOKED',
    );
    await expect(h.resolve.execute({ token: second, capability: 'logout', allowRotation: false })).resolves.toBeDefined();
    expect(h.telemetry.events.filter((event) => event.name === 'logout').map((event) => event.outcome)).toEqual([
      'success',
      'revoked',
    ]);
  });
});
