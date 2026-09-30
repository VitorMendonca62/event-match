import type { TransactionContext, UnitOfWorkPort } from '../../../../shared/application/ports/unit-of-work.port';
import { AuthenticatedSession } from '../../domain/entities/authenticated-session';
import { IdentityAccessError } from '../../domain/errors/identity-access.error';
import type { AccountAccessPolicyPort } from '../../domain/ports/outbound/account-access-policy.port';
import type {
  AuthenticationAccount,
  AuthenticationAccountReaderPort,
} from '../../domain/ports/outbound/authentication-account-reader.port';
import type {
  AuthenticationAttemptRepositoryPort,
  LoginAttemptReservation,
} from '../../domain/ports/outbound/authentication-attempt-repository.port';
import type { AuthenticatedSessionRepositoryPort } from '../../domain/ports/outbound/authenticated-session-repository.port';
import type {
  LoginSubjectPort,
  PasswordVerifierPort,
  SessionTokenPort,
} from '../../domain/ports/outbound/authentication-security.ports';
import type { AuthenticationTelemetryPort } from '../../domain/ports/outbound/authentication-telemetry.port';
import type { ClockPort, IdGeneratorPort } from '../../domain/ports/outbound/runtime.ports';
import type { SessionPolicy } from '../../domain/services/session-policy';
import { canHoldCommonSession } from '../../domain/value-objects/account-access';
import { LoginEmail } from '../../domain/value-objects/login-email';

/** Bounded cleanup of expired sessions piggybacked on each successful login (ADR-033). */
const PRUNE_BATCH = 20;

export interface AuthenticateAccountInput {
  readonly email: string;
  readonly password: string;
  readonly rememberMe: boolean;
  readonly originFingerprint: Uint8Array;
}

/** Internal result: the token goes only to the internal header, never to a JSON body. */
export interface AuthenticationResult {
  readonly token: string;
  readonly expiresAt: Date;
  readonly idleExpiresAt: Date;
  readonly remembered: boolean;
}

/**
 * RF008 login (ADR-033, ADR-035, ADR-036). Both buckets are reserved before the account is looked
 * up, a single Argon2id verification (real or dummy) runs outside any transaction, and every
 * refusal below the limit is the same `INVALID_CREDENTIALS`.
 */
export class AuthenticateAccount {
  constructor(
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly attempts: AuthenticationAttemptRepositoryPort,
    private readonly accounts: AuthenticationAccountReaderPort,
    private readonly sessions: AuthenticatedSessionRepositoryPort,
    private readonly policy: AccountAccessPolicyPort,
    private readonly verifier: PasswordVerifierPort,
    private readonly tokens: SessionTokenPort,
    private readonly subjects: LoginSubjectPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly telemetry: AuthenticationTelemetryPort,
    private readonly sessionPolicy: SessionPolicy,
  ) {}

  async execute(input: AuthenticateAccountInput): Promise<AuthenticationResult> {
    const started = this.clock.now();
    const correlationId = this.ids.next();
    const email = LoginEmail.normalize(input.email);
    const { windowMs, contactLimit, originLimit } = this.sessionPolicy.login;

    const { reservation, account } = await this.unitOfWork.execute(async (context) => {
      const reservation = await this.attempts.reserve(context, {
        contactSubject: email
          ? this.subjects.contactRateSubject(email)
          : this.subjects.unnormalizedRateSubject(input.email),
        originSubject: input.originFingerprint,
        now: started,
        windowMs,
        contactLimit,
        originLimit,
      });
      if (reservation.outcome !== 'allowed' || !email) return { reservation, account: null };
      return { reservation, account: await this.accounts.findByEmailHash(context, this.subjects.emailHash(email)) };
    });

    if (reservation.outcome !== 'allowed') {
      this.record('rate_limited', started, correlationId, {
        scope: reservation.outcome === 'contact_limited' ? 'contact' : 'origin',
      });
      throw new IdentityAccessError('RATE_LIMITED');
    }

    if (!(await this.credentialsAccepted(account, input.password)) || !account) {
      this.record('rejected', started, correlationId);
      throw new IdentityAccessError('INVALID_CREDENTIALS');
    }

    const issued = this.tokens.issue();
    const now = this.clock.now();
    const session = AuthenticatedSession.start(
      {
        id: this.ids.next(),
        accountId: account.accountId,
        tokenDigest: issued.digest,
        mode: input.rememberMe ? 'remembered' : 'browser',
      },
      now,
      this.sessionPolicy,
    );

    let evicted: number;
    try {
      evicted = await this.unitOfWork.execute(async (context) =>
        this.persist(context, session, reservation, now),
      );
    } catch (error) {
      if (error instanceof IdentityAccessError) this.record('rejected', started, correlationId);
      throw error;
    }

    this.record('success', started, correlationId, evicted > 0 ? { count: evicted } : {});
    return {
      token: issued.token,
      expiresAt: session.absoluteExpiresAt,
      idleExpiresAt: session.idleExpiresAt,
      remembered: session.remembered,
    };
  }

  /** Exactly one Argon2id verification per attempt; state and capability are checked after it. */
  private async credentialsAccepted(
    account: AuthenticationAccount | null,
    password: string,
  ): Promise<boolean> {
    if (!account?.passwordHash) {
      await this.verifier.verifyDummy(password);
      return false;
    }
    if (!(await this.verifier.verify(password, account.passwordHash))) return false;
    if (!canHoldCommonSession(account.status)) return false;
    return (await this.policy.decide(account.accountId, account.status, 'authenticated_home')) === 'allow';
  }

  private async persist(
    context: TransactionContext,
    session: AuthenticatedSession,
    reservation: Extract<LoginAttemptReservation, { outcome: 'allowed' }>,
    now: Date,
  ): Promise<number> {
    // Successes never consume the limits (ADR-035); a rollback below keeps the reservation.
    await this.attempts.release(context, reservation.reservationIds);
    // The state may have changed since the lookup: throwing here rolls the release back.
    const status = await this.accounts.findStatus(context, session.accountId);
    if (!status || !canHoldCommonSession(status)) throw new IdentityAccessError('INVALID_CREDENTIALS');
    const { evicted } = await this.sessions.insertWithinLimit(
      context,
      session,
      this.sessionPolicy.maxSessionsPerAccount,
      now,
    );
    await this.sessions.pruneExpired(context, now, PRUNE_BATCH);
    return evicted;
  }

  private record(
    outcome: 'success' | 'rejected' | 'rate_limited',
    started: Date,
    correlationId: string,
    extra: { scope?: 'contact' | 'origin'; count?: number } = {},
  ): void {
    this.telemetry.record({
      name: 'login',
      outcome,
      correlationId,
      durationMs: this.clock.now().getTime() - started.getTime(),
      ...extra,
    });
  }
}
