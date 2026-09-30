import { createHash, randomBytes } from 'node:crypto';

import type { TransactionContext, UnitOfWorkPort } from '../../src/shared/application/ports/unit-of-work.port';
import { AuthenticateAccount } from '../../src/modules/identity-access/application/use-cases/authenticate-account.use-case';
import { Logout } from '../../src/modules/identity-access/application/use-cases/logout.use-case';
import { ResolveAuthenticatedSession } from '../../src/modules/identity-access/application/use-cases/resolve-authenticated-session.use-case';
import { AuthenticatedSession } from '../../src/modules/identity-access/domain/entities/authenticated-session';
import type { AccountAccessPolicyPort } from '../../src/modules/identity-access/domain/ports/outbound/account-access-policy.port';
import type {
  AuthenticationAccount,
  AuthenticationAccountReaderPort,
} from '../../src/modules/identity-access/domain/ports/outbound/authentication-account-reader.port';
import type {
  AuthenticationAttemptRepositoryPort,
  LoginAttemptReservation,
  LoginAttemptReservationInput,
} from '../../src/modules/identity-access/domain/ports/outbound/authentication-attempt-repository.port';
import type {
  AuthenticatedSessionRepositoryPort,
  SessionMatch,
} from '../../src/modules/identity-access/domain/ports/outbound/authenticated-session-repository.port';
import type {
  IssuedSessionToken,
  LoginSubjectPort,
  PasswordVerifierPort,
  SessionTokenPort,
} from '../../src/modules/identity-access/domain/ports/outbound/authentication-security.ports';
import type {
  AuthenticationEvent,
  AuthenticationTelemetryPort,
} from '../../src/modules/identity-access/domain/ports/outbound/authentication-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../src/modules/identity-access/domain/ports/outbound/runtime.ports';
import type { SessionPolicy } from '../../src/modules/identity-access/domain/services/session-policy';
import type {
  AccessDecision,
  AccountCapability,
  AccountStatus,
} from '../../src/modules/identity-access/domain/value-objects/account-access';
import type { LoginEmail } from '../../src/modules/identity-access/domain/value-objects/login-email';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** The confirmed product defaults (SDD-013 §4.2). */
export const DEFAULT_POLICY: SessionPolicy = {
  browser: { absoluteTtlMs: 12 * HOUR, idleTtlMs: 30 * MINUTE },
  remembered: { absoluteTtlMs: 30 * DAY, idleTtlMs: 7 * DAY },
  activityWriteIntervalMs: 5 * MINUTE,
  renewalIntervalMs: DAY,
  previousTokenGraceMs: MINUTE,
  maxSessionsPerAccount: 5,
  login: { windowMs: 15 * MINUTE, contactLimit: 5, originLimit: 30 },
};

const hex = (value: Uint8Array) => Buffer.from(value).toString('hex');

export class FakeIdentityClock implements ClockPort {
  constructor(public current = new Date('2026-09-29T12:00:00.000Z')) {}
  now() {
    return new Date(this.current);
  }
  advance(milliseconds: number) {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

class SequentialIds implements IdGeneratorPort {
  private sequence = 0;
  next() {
    this.sequence += 1;
    return `00000000-0000-7000-8000-${this.sequence.toString(16).padStart(12, '0')}`;
  }
}

interface StoredAccount {
  status: AccountStatus;
  emailHash: string;
  passwordHash: string | null;
}

interface State {
  accounts: Map<string, StoredAccount>;
  sessions: Map<string, AuthenticatedSession>;
  attempts: { id: string; scope: 'contact' | 'origin'; subject: string; at: number }[];
}

export class InMemoryIdentityDatabase {
  state: State = { accounts: new Map(), sessions: new Map(), attempts: [] };

  snapshot(): State {
    return {
      accounts: new Map([...this.state.accounts].map(([id, value]) => [id, { ...value }])),
      sessions: new Map(this.state.sessions),
      attempts: this.state.attempts.map((value) => ({ ...value })),
    };
  }
}

/** Rolls the whole state back when the work throws, like a PostgreSQL transaction. */
export class FakeIdentityUnitOfWork implements UnitOfWorkPort {
  transactions = 0;
  constructor(private readonly database: InMemoryIdentityDatabase) {}
  async execute<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    this.transactions += 1;
    const before = this.database.snapshot();
    try {
      return await work({ fake: true });
    } catch (error) {
      this.database.state = before;
      throw error;
    }
  }
}

class InMemoryAccounts implements AuthenticationAccountReaderPort {
  lookups = 0;
  constructor(private readonly database: InMemoryIdentityDatabase) {}
  async findByEmailHash(_: TransactionContext, emailHash: Uint8Array): Promise<AuthenticationAccount | null> {
    this.lookups += 1;
    for (const [accountId, account] of this.database.state.accounts) {
      if (account.emailHash === hex(emailHash)) {
        return { accountId, status: account.status, passwordHash: account.passwordHash };
      }
    }
    return null;
  }
  async findStatus(_: TransactionContext, accountId: string): Promise<AccountStatus | null> {
    return this.database.state.accounts.get(accountId)?.status ?? null;
  }
}

class InMemoryAttempts implements AuthenticationAttemptRepositoryPort {
  private sequence = 0;
  constructor(private readonly database: InMemoryIdentityDatabase) {}
  async reserve(_: TransactionContext, input: LoginAttemptReservationInput): Promise<LoginAttemptReservation> {
    const start = input.now.getTime() - input.windowMs;
    const state = this.database.state;
    state.attempts = state.attempts.filter((attempt) => attempt.at > start);
    const buckets = [
      ['contact', hex(input.contactSubject), input.contactLimit],
      ['origin', hex(input.originSubject), input.originLimit],
    ] as const;
    for (const [scope, subject, limit] of buckets) {
      const used = state.attempts.filter((attempt) => attempt.scope === scope && attempt.subject === subject).length;
      if (used >= limit) return { outcome: scope === 'contact' ? 'contact_limited' : 'origin_limited' };
    }
    const ids = buckets.map(([scope, subject]) => {
      this.sequence += 1;
      const id = `attempt-${this.sequence}`;
      state.attempts.push({ id, scope, subject, at: input.now.getTime() });
      return id;
    });
    return { outcome: 'allowed', reservationIds: ids };
  }
  async release(_: TransactionContext, ids: readonly string[]): Promise<void> {
    this.database.state.attempts = this.database.state.attempts.filter((attempt) => !ids.includes(attempt.id));
  }
}

class InMemorySessions implements AuthenticatedSessionRepositoryPort {
  constructor(private readonly database: InMemoryIdentityDatabase) {}
  async insertWithinLimit(_: TransactionContext, session: AuthenticatedSession, max: number, now: Date) {
    const sessions = this.database.state.sessions;
    for (const [id, value] of sessions) if (value.accountId === session.accountId && value.expiry(now)) sessions.delete(id);
    const live = [...sessions.values()]
      .filter((value) => value.accountId === session.accountId)
      .sort((a, b) => a.lastSeenAt.getTime() - b.lastSeenAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
    const excess = Math.max(0, live.length - max + 1);
    for (const value of live.slice(0, excess)) sessions.delete(value.id);
    sessions.set(session.id, session);
    return { evicted: excess };
  }
  async findByDigestForUpdate(_: TransactionContext, digest: Uint8Array, now: Date): Promise<SessionMatch | null> {
    for (const session of this.database.state.sessions.values()) {
      if (hex(session.tokenDigest) === hex(digest)) return { session, matched: 'current' };
      if (session.previousTokenDigest && hex(session.previousTokenDigest) === hex(digest) && session.acceptsPrevious(now)) {
        return { session, matched: 'previous' };
      }
    }
    return null;
  }
  async save(_: TransactionContext, session: AuthenticatedSession) {
    this.database.state.sessions.set(session.id, session);
  }
  async delete(_: TransactionContext, id: string) {
    this.database.state.sessions.delete(id);
  }
  async deleteByDigest(context: TransactionContext, digest: Uint8Array, now: Date) {
    const match = await this.findByDigestForUpdate(context, digest, now);
    if (!match) return false;
    this.database.state.sessions.delete(match.session.id);
    return true;
  }
  async pruneExpired(_: TransactionContext, now: Date, limit: number) {
    let removed = 0;
    for (const [id, session] of this.database.state.sessions) {
      if (removed >= limit) break;
      if (session.expiry(now)) {
        this.database.state.sessions.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}

/** `hash:<password>` stands for a real Argon2id hash; verification counts are observable. */
export class FakePasswordVerifier implements PasswordVerifierPort {
  real = 0;
  dummy = 0;
  failWith: Error | null = null;
  async verify(candidate: string, hash: string) {
    this.real += 1;
    if (this.failWith) throw this.failWith;
    return hash === `hash:${candidate}`;
  }
  async verifyDummy() {
    this.dummy += 1;
  }
}

export class FakeSessionTokens implements SessionTokenPort {
  issued: string[] = [];
  issue(): IssuedSessionToken {
    const token = randomBytes(32).toString('base64url');
    this.issued.push(token);
    return { token, digest: this.digest(token) };
  }
  digest(token: string) {
    return createHash('sha256').update(`session:${token}`).digest();
  }
}

export class FakeLoginSubjects implements LoginSubjectPort {
  emailHash(email: LoginEmail) {
    return createHash('sha256').update(`contact:email:${email.value}`).digest();
  }
  contactRateSubject(email: LoginEmail) {
    return createHash('sha256').update(`auth:login:contact:email:${email.value}`).digest();
  }
  unnormalizedRateSubject(raw: string) {
    return createHash('sha256').update(`auth:login:contact:raw:${raw}`).digest();
  }
}

/** Allows the published capabilities of `active` accounts unless a capability is explicitly denied. */
export class FakeAccessPolicy implements AccountAccessPolicyPort {
  denied = new Set<AccountCapability>();
  async decide(_: string, status: AccountStatus, capability: AccountCapability): Promise<AccessDecision> {
    return status === 'active' && !this.denied.has(capability) ? 'allow' : 'deny';
  }
}

export class CapturingAuthTelemetry implements AuthenticationTelemetryPort {
  readonly events: AuthenticationEvent[] = [];
  record(event: AuthenticationEvent) {
    this.events.push(event);
  }
}

export const ORIGIN = Buffer.alloc(32, 9);

export function createIdentityHarness(policy: SessionPolicy = DEFAULT_POLICY) {
  const database = new InMemoryIdentityDatabase();
  const unitOfWork = new FakeIdentityUnitOfWork(database);
  const accounts = new InMemoryAccounts(database);
  const attempts = new InMemoryAttempts(database);
  const sessions = new InMemorySessions(database);
  const accessPolicy = new FakeAccessPolicy();
  const verifier = new FakePasswordVerifier();
  const tokens = new FakeSessionTokens();
  const subjects = new FakeLoginSubjects();
  const clock = new FakeIdentityClock();
  const ids = new SequentialIds();
  const telemetry = new CapturingAuthTelemetry();

  const addAccount = (email: string, password: string | null, status: AccountStatus = 'active') => {
    const accountId = ids.next();
    database.state.accounts.set(accountId, {
      status,
      emailHash: hex(createHash('sha256').update(`contact:email:${email}`).digest()),
      passwordHash: password === null ? null : `hash:${password}`,
    });
    return accountId;
  };

  return {
    database,
    unitOfWork,
    accounts,
    sessions,
    accessPolicy,
    verifier,
    tokens,
    clock,
    telemetry,
    policy,
    addAccount,
    authenticate: new AuthenticateAccount(
      unitOfWork,
      attempts,
      accounts,
      sessions,
      accessPolicy,
      verifier,
      tokens,
      subjects,
      clock,
      ids,
      telemetry,
      policy,
    ),
    resolve: new ResolveAuthenticatedSession(unitOfWork, sessions, accounts, accessPolicy, tokens, clock, ids, telemetry, policy),
    logout: new Logout(unitOfWork, sessions, tokens, clock, ids, telemetry),
  };
}

export type IdentityHarness = ReturnType<typeof createIdentityHarness>;
